import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { reset } from "../../src/commands/reset.js";
import { enableSkill } from "../../src/core/activator.js";
import { canonicalizeProjectId } from "../../src/utils/paths.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
  saveSourcesRegistry,
  loadProjectsRegistry,
  saveProjectsRegistry,
} from "../../src/services/registry.js";

describe("reset", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hk-skills-reset-test-"));

    const dirs = [
      "registry",
      "manifests",
      "warehouse/remote",
      "warehouse/adapted",
      "warehouse/local",
      "runtime/global",
      "runtime/projects",
      "logs",
      "patches",
      "docs",
      "custom",
      "skills",
    ];
    for (const dir of dirs) {
      fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
    }

    saveSkillsRegistry(tempDir, {
      "test-skill": {
        manifest: "manifests/test-skill.yaml",
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id: "test-source",
      },
    });
    saveSourcesRegistry(tempDir, {
      "test-source": {
        type: "remote",
        repo: "https://github.com/example/test-skill.git",
        ref: "main",
        local_path: path.join(tempDir, "warehouse", "remote", "test-source"),
      },
    });
    saveProjectsRegistry(tempDir, {
      "my-app": { path: "/fake/path/my-app", skills: ["test-skill"] },
    });

    fs.writeFileSync(
      path.join(tempDir, "manifests", "test-skill.yaml"),
      "name: test-skill\n",
      "utf-8"
    );
    fs.mkdirSync(path.join(tempDir, "warehouse", "adapted", "test-skill"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "warehouse", "adapted", "test-skill", "SKILL.md"),
      "# Test\n",
      "utf-8"
    );
    fs.mkdirSync(path.join(tempDir, "warehouse", "remote", "test-source"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "warehouse", "remote", "test-source", "SKILL.md"),
      "# Remote\n",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tempDir, "docs", "catalog.md"),
      "# Catalog\n",
      "utf-8"
    );
    fs.writeFileSync(path.join(tempDir, "logs", "install.log"), "log\n", "utf-8");
    fs.writeFileSync(path.join(tempDir, "patches", "some.patch"), "patch\n", "utf-8");

    fs.mkdirSync(path.join(tempDir, "warehouse", "local", "local-skill"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "warehouse", "local", "local-skill", "SKILL.md"),
      "# Local\n",
      "utf-8"
    );
    fs.mkdirSync(path.join(tempDir, "custom", "my-custom"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "custom", "my-custom", "SKILL.md"),
      "# Custom\n",
      "utf-8"
    );
    fs.mkdirSync(path.join(tempDir, "skills", "my-skill"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "skills", "my-skill", "SKILL.md"),
      "# Skill\n",
      "utf-8"
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("clears all managed registry JSON files to empty objects", async () => {
    await reset(tempDir, { yes: true });

    expect(loadSkillsRegistry(tempDir)).toEqual({});
    expect(loadSourcesRegistry(tempDir)).toEqual({});
    expect(loadProjectsRegistry(tempDir)).toEqual({});
  });

  it("removes global and encoded project runtime symlinks", async () => {
    const myAppDir = path.join(tempDir, "my-app");
    fs.mkdirSync(myAppDir, { recursive: true });
    const realProjectDir = path.join(tempDir, "real-project");
    fs.mkdirSync(realProjectDir, { recursive: true });

    enableSkill(tempDir, "test-skill", "global");
    enableSkill(tempDir, "test-skill", { project: myAppDir });
    enableSkill(tempDir, "test-skill", { project: realProjectDir });

    await reset(tempDir, { yes: true });

    expect(fs.existsSync(path.join(tempDir, "runtime", "global", "test-skill"))).toBe(false);
    expect(
      fs.existsSync(path.join(tempDir, "runtime", "projects", canonicalizeProjectId(myAppDir), "test-skill"))
    ).toBe(false);
    expect(
      fs.readdirSync(path.join(tempDir, "runtime", "global")).length
    ).toBe(0);
    expect(
      fs.readdirSync(path.join(tempDir, "runtime", "projects")).length
    ).toBe(0);
  });

  it("is idempotent when run twice", async () => {
    await reset(tempDir, { yes: true });
    await reset(tempDir, { yes: true });

    expect(loadSkillsRegistry(tempDir)).toEqual({});
    expect(loadSourcesRegistry(tempDir)).toEqual({});
    expect(loadProjectsRegistry(tempDir)).toEqual({});
    expect(fs.existsSync(path.join(tempDir, "manifests", "test-skill.yaml"))).toBe(false);
    expect(fs.readdirSync(path.join(tempDir, "runtime", "global")).length).toBe(0);
  });

  it("preserves warehouse/local, custom, and skills directories and their contents", async () => {
    await reset(tempDir, { yes: true });

    expect(
      fs.existsSync(path.join(tempDir, "warehouse", "local", "local-skill", "SKILL.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "custom", "my-custom", "SKILL.md"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "skills", "my-skill", "SKILL.md"))
    ).toBe(true);
  });

  it("removes generated docs/catalog.md", async () => {
    await reset(tempDir, { yes: true });

    expect(fs.existsSync(path.join(tempDir, "docs", "catalog.md"))).toBe(false);
  });

  it("clears manifests, warehouse/adapted, and warehouse/remote contents", async () => {
    await reset(tempDir, { yes: true });

    expect(fs.existsSync(path.join(tempDir, "manifests", "test-skill.yaml"))).toBe(false);
    expect(
      fs.existsSync(path.join(tempDir, "warehouse", "adapted", "test-skill", "SKILL.md"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(tempDir, "warehouse", "remote", "test-source", "SKILL.md"))
    ).toBe(false);
  });

  it("ensures managed directories still exist after reset", async () => {
    await reset(tempDir, { yes: true });

    const managedDirs = [
      "registry",
      "manifests",
      "warehouse/remote",
      "warehouse/adapted",
      "warehouse/local",
      "runtime/global",
      "runtime/projects",
      "logs",
      "patches",
      "docs",
    ];
    for (const dir of managedDirs) {
      expect(fs.existsSync(path.join(tempDir, dir))).toBe(true);
    }
  });

  it("skips confirmation when --yes is passed", async () => {
    await reset(tempDir, { yes: true });

    expect(loadSkillsRegistry(tempDir)).toEqual({});
  });

  it("does not reset anything when user declines confirmation", async () => {
    await reset(tempDir, { promptConfirm: async () => false });

    expect(Object.keys(loadSkillsRegistry(tempDir))).toContain("test-skill");
    expect(fs.existsSync(path.join(tempDir, "manifests", "test-skill.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "docs", "catalog.md"))).toBe(true);
  });

  it("auto-continues in non-TTY without --yes", async () => {
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;
    try {
      await reset(tempDir);
    } finally {
      process.stdin.isTTY = originalIsTTY;
    }

    expect(loadSkillsRegistry(tempDir)).toEqual({});
    expect(fs.existsSync(path.join(tempDir, "manifests", "test-skill.yaml"))).toBe(false);
  });

  it("clears managed tmp and backup artifacts", async () => {
    fs.writeFileSync(path.join(tempDir, "registry", ".skills.json.tmp.123"), "tmp", "utf-8");
    fs.writeFileSync(path.join(tempDir, "registry", ".backup.20240101.json"), "bak", "utf-8");
    fs.writeFileSync(path.join(tempDir, "manifests", ".test-skill.yaml.tmp.abc"), "tmp", "utf-8");
    fs.writeFileSync(path.join(tempDir, "warehouse", "adapted", ".adapted.tmp.old"), "tmp", "utf-8");
    fs.writeFileSync(path.join(tempDir, "warehouse", "remote", ".remote.backup.data"), "bak", "utf-8");

    await reset(tempDir, { yes: true });

    expect(fs.existsSync(path.join(tempDir, "registry", ".skills.json.tmp.123"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "registry", ".backup.20240101.json"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "manifests", ".test-skill.yaml.tmp.abc"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "warehouse", "adapted", ".adapted.tmp.old"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "warehouse", "remote", ".remote.backup.data"))).toBe(false);
  });
});
