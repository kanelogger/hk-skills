import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { init } from "../../src/commands/init.js";
import { list } from "../../src/commands/list.js";
import { enableSkill, disableSkill } from "../../src/core/activator.js";
import { install } from "../../src/commands/install.js";
import { reset } from "../../src/commands/reset.js";
import { loadSkillsRegistry, loadSourcesRegistry, loadProjectsRegistry } from "../../src/services/registry.js";
import { canonicalizeProjectId } from "../../src/utils/paths.js";
import { discoverSkills } from "../../src/core/discover-skills.js";

describe("full-lifecycle", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "hk-skills-lifecycle-test-")
    );

    const customSkillDir = path.join(tempDir, "custom", "test-skill");
    fs.mkdirSync(customSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(customSkillDir, "SKILL.md"),
      `---\nname: test-skill\n---\n\n# test-skill\n`,
      "utf-8"
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("runs full lifecycle: init, list, enable, disable, install", async () => {
    init(tempDir);

    expect(() => list(tempDir)).not.toThrow();

    enableSkill(tempDir, "test-skill", "global");

    const linkPath = path.join(tempDir, "runtime", "global", "test-skill");
    expect(fs.existsSync(linkPath)).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);

    disableSkill(tempDir, "test-skill", "global");

    expect(fs.existsSync(linkPath)).toBe(false);

    const localSkillPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "hk-skills-local-skill-")
    );
    fs.writeFileSync(
      path.join(localSkillPath, "SKILL.md"),
      `---\nname: local-test-skill\n---\n\n# local-test-skill\n`,
      "utf-8"
    );

    try {
      await install(tempDir, localSkillPath, { local: true });

      const registry = loadSkillsRegistry(tempDir);
      expect(registry["local-test-skill"]).toBeDefined();
      expect(registry["local-test-skill"]!.installed).toBe(true);
      expect(registry["local-test-skill"]!.source_id).toBeDefined();

      const sources = loadSourcesRegistry(tempDir);
      const sourceId = registry["local-test-skill"]!.source_id;
      expect(sources[sourceId]).toBeDefined();
      expect(sources[sourceId]!.type).toBe("local");
      expect(sources[sourceId]!.local_path).toBeDefined();
    } finally {
      fs.rmSync(localSkillPath, { recursive: true, force: true });
    }
  });

  it("keeps project-scoped runtime links under encoded runtime directory and discovers managed in-project symlinks", async () => {
    init(tempDir);

    const projectDir = path.join(os.tmpdir(), "hk-skills-project-" + Date.now());
    fs.mkdirSync(projectDir, { recursive: true });

    try {
      enableSkill(tempDir, "test-skill", { project: projectDir });

      const encodedId = canonicalizeProjectId(projectDir);
      const scopedRuntimeDir = path.join(tempDir, "runtime", "projects", encodedId);
      const linkPath = path.join(scopedRuntimeDir, "test-skill");

      expect(fs.existsSync(linkPath)).toBe(true);
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);

      const discovered = discoverSkills(projectDir);
      expect(discovered).toContainEqual({ subpath: ".agents/skills/test-skill", name: "test-skill" });

      const registry = loadSkillsRegistry(tempDir);
      expect(registry["test-skill"]).toBeDefined();
      expect(registry["test-skill"]!.enabled_projects).toContain(encodedId);

      disableSkill(tempDir, "test-skill", { project: projectDir });
      expect(fs.existsSync(linkPath)).toBe(false);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("reset clears encoded project-scoped runtime state and returns to empty managed baseline", async () => {
    init(tempDir);

    const projectDir = path.join(os.tmpdir(), "hk-skills-project-" + Date.now());
    fs.mkdirSync(projectDir, { recursive: true });

    try {
      enableSkill(tempDir, "test-skill", "global");
      enableSkill(tempDir, "test-skill", { project: projectDir });

      await reset(tempDir, { yes: true });

      expect(fs.existsSync(path.join(tempDir, "runtime", "global", "test-skill"))).toBe(false);

      const encodedId = canonicalizeProjectId(projectDir);
      expect(fs.existsSync(path.join(tempDir, "runtime", "projects", encodedId, "test-skill"))).toBe(false);
      expect(fs.readdirSync(path.join(tempDir, "runtime", "projects")).length).toBe(0);

      expect(loadSkillsRegistry(tempDir)).toEqual({});
      expect(loadSourcesRegistry(tempDir)).toEqual({});
      expect(loadProjectsRegistry(tempDir)).toEqual({});

      expect(fs.existsSync(path.join(tempDir, "manifests", "test-skill.yaml"))).toBe(false);

      expect(fs.existsSync(path.join(tempDir, "custom", "test-skill", "SKILL.md"))).toBe(true);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("does not discover arbitrary non-managed symlinks under .agents/skills/", async () => {
    init(tempDir);

    const projectDir = path.join(os.tmpdir(), "hk-skills-project-" + Date.now());
    fs.mkdirSync(projectDir, { recursive: true });

    try {
      const agentsSkillsDir = path.join(projectDir, ".agents", "skills");
      fs.mkdirSync(agentsSkillsDir, { recursive: true });

      const arbitraryDir = path.join(os.tmpdir(), "hk-skills-arbitrary-" + Date.now());
      fs.mkdirSync(arbitraryDir, { recursive: true });
      fs.writeFileSync(path.join(arbitraryDir, "SKILL.md"), "---\nname: arbitrary-skill\n---\n\n# arbitrary\n", "utf-8");
      fs.symlinkSync(arbitraryDir, path.join(agentsSkillsDir, "arbitrary-skill"));

      const discovered = discoverSkills(projectDir);
      expect(discovered).not.toContainEqual({ subpath: ".agents/skills/arbitrary-skill", name: "arbitrary-skill" });

      fs.rmSync(arbitraryDir, { recursive: true, force: true });
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
