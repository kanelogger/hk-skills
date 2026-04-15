import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { parse } from "yaml";
import { adapt, type AdaptResult } from "../../src/core/adapter.js";

describe("adapt", () => {
  let tempRoot: string;
  let skillDir: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(resolve(tmpdir(), "hk-skills-test-"));
    skillDir = resolve(tempRoot, "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      `---\nname: test-skill\ndisplay_name: Test Skill\n---\n\n# Test Skill\n`,
      "utf-8"
    );
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("adapting a valid skill creates manifest YAML and copies files", () => {
    const result: AdaptResult = adapt(skillDir, tempRoot, "local");

    expect(result.success).toBe(true);
    expect(result.name).toBe("test-skill");
    expect(result.errors).toEqual([]);

    const manifestPath = resolve(tempRoot, "manifests", "test-skill.yaml");
    expect(existsSync(manifestPath)).toBe(true);

    const warehousePath = resolve(tempRoot, "warehouse", "adapted", "test-skill");
    expect(existsSync(warehousePath)).toBe(true);
    expect(existsSync(resolve(warehousePath, "SKILL.md"))).toBe(true);
  });

  it("manifest YAML contains correct fields", () => {
    const result: AdaptResult = adapt(skillDir, tempRoot, "remote");

    expect(result.success).toBe(true);
    expect(result.name).toBe("test-skill");

    const manifestPath = resolve(tempRoot, "manifests", "test-skill.yaml");
    const manifestContent = readFileSync(manifestPath, "utf-8");
    const manifest = parse(manifestContent) as Record<string, unknown>;

    expect(manifest.name).toBe("test-skill");
    expect(manifest.display_name).toBe("Test Skill");
    expect(manifest.source).toEqual({ type: "remote" });
    expect(manifest.status).toEqual({ stage: "adapted" });
    expect(manifest.entry).toEqual({ file: "SKILL.md" });
  });

  it("manifest YAML includes repo, ref, and commit when provided for remote source", () => {
    const result: AdaptResult = adapt(skillDir, tempRoot, "remote", "https://github.com/user/repo", "main", "abc123");

    expect(result.success).toBe(true);

    const manifestPath = resolve(tempRoot, "manifests", "test-skill.yaml");
    const manifestContent = readFileSync(manifestPath, "utf-8");
    const manifest = parse(manifestContent) as Record<string, unknown>;

    expect(manifest.source).toEqual({
      type: "remote",
      repo: "https://github.com/user/repo",
      ref: "main",
      commit: "abc123",
    });
  });

  it("falls back to frontmatter repo when repo param is omitted", () => {
    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      `---\nname: test-skill\ndisplay_name: Test Skill\nrepo: https://github.com/fallback/repo\n---\n\n# Test Skill\n`,
      "utf-8"
    );

    const result: AdaptResult = adapt(skillDir, tempRoot, "remote");

    expect(result.success).toBe(true);

    const manifestPath = resolve(tempRoot, "manifests", "test-skill.yaml");
    const manifestContent = readFileSync(manifestPath, "utf-8");
    const manifest = parse(manifestContent) as Record<string, unknown>;

    expect(manifest.source).toEqual({
      type: "remote",
      repo: "https://github.com/fallback/repo",
    });
  });

  it("falls back to directory basename when frontmatter name is missing", () => {
    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      `# My Skill\n\nNo frontmatter here.\n`,
      "utf-8"
    );

    const result: AdaptResult = adapt(skillDir, tempRoot, "local");

    expect(result.success).toBe(true);
    expect(result.name).toBe("my-skill");

    const manifestPath = resolve(tempRoot, "manifests", "my-skill.yaml");
    const manifestContent = readFileSync(manifestPath, "utf-8");
    const manifest = parse(manifestContent) as Record<string, unknown>;

    expect(manifest.name).toBe("my-skill");
    expect(manifest.display_name).toBe("my-skill");
    expect(manifest.source).toEqual({ type: "local" });
  });

  it("rewrites SKILL.md content for the current agent when HK_AGENT is set", () => {
    const originalAgent = process.env.HK_AGENT;
    process.env.HK_AGENT = "opencode";

    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      `---\nname: test-skill\ndisplay_name: Test Skill\n---\n\nThis skill is designed for Claude Code.\n`,
      "utf-8"
    );

    try {
      const result: AdaptResult = adapt(skillDir, tempRoot, "local");

      expect(result.success).toBe(true);

      const adaptedSkillPath = resolve(tempRoot, "warehouse", "adapted", "test-skill", "SKILL.md");
      const adaptedContent = readFileSync(adaptedSkillPath, "utf-8");

      expect(adaptedContent).toContain("opencode");
      expect(adaptedContent).not.toContain("Claude Code");
    } finally {
      if (originalAgent === undefined) {
        delete process.env.HK_AGENT;
      } else {
        process.env.HK_AGENT = originalAgent;
      }
    }
  });

  it("manifest YAML contains adapter target and adapted_from fields when rewriting occurs", () => {
    const originalAgent = process.env.HK_AGENT;
    process.env.HK_AGENT = "opencode";

    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      `---\nname: test-skill\ndisplay_name: Test Skill\n---\n\nThis skill is designed for Claude Code.\n`,
      "utf-8"
    );

    try {
      const result: AdaptResult = adapt(skillDir, tempRoot, "local");

      expect(result.success).toBe(true);

      const manifestPath = resolve(tempRoot, "manifests", "test-skill.yaml");
      const manifestContent = readFileSync(manifestPath, "utf-8");
      const manifest = parse(manifestContent) as Record<string, unknown>;

      expect(manifest.adapter).toEqual({
        target: "opencode",
        adapted_from: "claude-code",
      });
    } finally {
      if (originalAgent === undefined) {
        delete process.env.HK_AGENT;
      } else {
        process.env.HK_AGENT = originalAgent;
      }
    }
  });

  it("falls back to copy-only when the adapter engine is missing", () => {
    const enginePath = resolve(process.cwd(), "warehouse/local/adapter/engine.ts");
    const backupPath = `${enginePath}.bak`;

    if (!existsSync(enginePath)) {
      return;
    }

    renameSync(enginePath, backupPath);

    try {
      const result: AdaptResult = adapt(skillDir, tempRoot, "local");

      expect(result.success).toBe(true);

      const adaptedSkillPath = resolve(tempRoot, "warehouse", "adapted", "test-skill", "SKILL.md");
      const adaptedContent = readFileSync(adaptedSkillPath, "utf-8");

      expect(adaptedContent).toBe(
        `---\nname: test-skill\ndisplay_name: Test Skill\n---\n\n# Test Skill\n`
      );
    } finally {
      renameSync(backupPath, enginePath);
    }
  });

  it("skips rewriting when the skill name is adapter (self-adaptation guard)", () => {
    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      `---\nname: adapter\ndisplay_name: Adapter\n---\n\nThis skill is designed for Claude Code.\n`,
      "utf-8"
    );

    const result: AdaptResult = adapt(skillDir, tempRoot, "local");

    expect(result.success).toBe(true);

    const adaptedSkillPath = resolve(tempRoot, "warehouse", "adapted", "adapter", "SKILL.md");
    const adaptedContent = readFileSync(adaptedSkillPath, "utf-8");

    expect(adaptedContent).toContain("Claude Code");
    expect(adaptedContent).not.toContain("opencode");
  });
});
