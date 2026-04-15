import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { remove } from "../../src/commands/remove.js";
import { enableSkill } from "../../src/core/activator.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
  saveSourcesRegistry,
  loadProjectsRegistry,
  saveProjectsRegistry,
} from "../../src/services/registry.js";

describe("remove", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let logs: string[];
  let originalWarn: typeof console.warn;
  let originalLog: typeof console.log;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hk-skills-remove-test-"));
    fs.mkdirSync(path.join(tempDir, "registry"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "manifests"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "warehouse", "adapted", "test-skill"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "warehouse", "adapted", "test-skill", "SKILL.md"),
      "# Test",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tempDir, "manifests", "test-skill.yaml"),
      "name: test-skill\n",
      "utf-8"
    );

    saveSkillsRegistry(tempDir, {
      "test-skill": {
        manifest: "manifests/test-skill.yaml",
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });
    saveSourcesRegistry(tempDir, {
      "test-skill": [{ repo: "https://github.com/example/test-skill.git", ref: "main" }],
    });
    saveProjectsRegistry(tempDir, {
      "my-app": { path: "/fake/path/my-app", skills: ["test-skill"] },
    });

    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    logs = [];
    originalWarn = console.warn;
    originalLog = console.log;
    console.warn = (msg: string) => {
      logs.push(msg);
    };
    console.log = (msg: string) => {
      logs.push(msg);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
    console.log = originalLog;
    if (exitSpy) exitSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes an unenabled skill and cleans all registry entries and files", async () => {
    exitSpy.mockRestore();

    await remove(tempDir, "test-skill", { promptConfirm: async () => true });

    const skills = loadSkillsRegistry(tempDir);
    expect(skills["test-skill"]).toBeUndefined();

    const sources = loadSourcesRegistry(tempDir);
    expect(sources["test-skill"]).toBeUndefined();

    const projects = loadProjectsRegistry(tempDir);
    expect(projects["my-app"]!.skills).not.toContain("test-skill");

    expect(fs.existsSync(path.join(tempDir, "warehouse", "adapted", "test-skill"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "manifests", "test-skill.yaml"))).toBe(false);
  });

  it("disables global and project symlinks before removing files", async () => {
    exitSpy.mockRestore();
    enableSkill(tempDir, "test-skill", "global");
    enableSkill(tempDir, "test-skill", { project: "my-app" });

    await remove(tempDir, "test-skill", { promptConfirm: async () => true });

    expect(fs.existsSync(path.join(tempDir, "runtime", "global", "test-skill"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "runtime", "projects", "my-app", "test-skill"))).toBe(false);

    const skills = loadSkillsRegistry(tempDir);
    expect(skills["test-skill"]).toBeUndefined();
    expect(fs.existsSync(path.join(tempDir, "warehouse", "adapted", "test-skill"))).toBe(false);
  });

  it("exits with error when removing a non-existent skill", async () => {
    await expect(
      remove(tempDir, "non-existent", { promptConfirm: async () => true })
    ).rejects.toThrow("process.exit called");
  });

  it("warns and continues when warehouse directory is already missing", async () => {
    exitSpy.mockRestore();
    fs.rmSync(path.join(tempDir, "warehouse", "adapted", "test-skill"), { recursive: true, force: true });

    await remove(tempDir, "test-skill", { promptConfirm: async () => true });

    expect(logs.some((l) => l.includes("warehouse") || l.includes("not found"))).toBe(true);

    const skills = loadSkillsRegistry(tempDir);
    expect(skills["test-skill"]).toBeUndefined();
  });

  it("removes only unenabled skills with --unused", async () => {
    exitSpy.mockRestore();
    fs.mkdirSync(path.join(tempDir, "warehouse", "adapted", "used-skill"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "warehouse", "adapted", "used-skill", "SKILL.md"), "# Used", "utf-8");
    fs.writeFileSync(path.join(tempDir, "manifests", "used-skill.yaml"), "name: used-skill\n", "utf-8");
    fs.mkdirSync(path.join(tempDir, "warehouse", "adapted", "unused-skill"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "warehouse", "adapted", "unused-skill", "SKILL.md"), "# Unused", "utf-8");
    fs.writeFileSync(path.join(tempDir, "manifests", "unused-skill.yaml"), "name: unused-skill\n", "utf-8");

    saveSkillsRegistry(tempDir, {
      "test-skill": {
        manifest: "manifests/test-skill.yaml",
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
      "used-skill": {
        manifest: "manifests/used-skill.yaml",
        installed: true,
        enabled_global: true,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
      "unused-skill": {
        manifest: "manifests/unused-skill.yaml",
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    await remove(tempDir, undefined, { unused: true, yes: true });

    const skills = loadSkillsRegistry(tempDir);
    expect(skills["test-skill"]).toBeUndefined();
    expect(skills["used-skill"]).toBeDefined();
    expect(skills["unused-skill"]).toBeUndefined();

    expect(fs.existsSync(path.join(tempDir, "warehouse", "adapted", "used-skill"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "warehouse", "adapted", "unused-skill"))).toBe(false);
  });

  it("exits gracefully when --unused finds no skills to remove", async () => {
    exitSpy.mockRestore();
    saveSkillsRegistry(tempDir, {
      "test-skill": {
        manifest: "manifests/test-skill.yaml",
        installed: true,
        enabled_global: true,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    await remove(tempDir, undefined, { unused: true });

    expect(logs.some((l) => l.includes("No unused skills"))).toBe(true);
    const skills = loadSkillsRegistry(tempDir);
    expect(skills["test-skill"]).toBeDefined();
  });

  it("skips confirmation when --yes is passed with --unused", async () => {
    exitSpy.mockRestore();
    await remove(tempDir, undefined, { unused: true, yes: true });

    const skills = loadSkillsRegistry(tempDir);
    expect(skills["test-skill"]).toBeUndefined();
  });

  it("does not remove anything when user declines confirmation", async () => {
    exitSpy.mockRestore();

    await remove(tempDir, "test-skill", { promptConfirm: async () => false });

    const skills = loadSkillsRegistry(tempDir);
    expect(skills["test-skill"]).toBeDefined();
    expect(fs.existsSync(path.join(tempDir, "warehouse", "adapted", "test-skill"))).toBe(true);
  });

  it("exits with error when both positional name and --unused are provided", async () => {
    await expect(
      remove(tempDir, "test-skill", { unused: true, yes: true })
    ).rejects.toThrow("process.exit called");
  });
});
