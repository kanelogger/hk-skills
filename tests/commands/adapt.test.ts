import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { adaptCommand } from "../../src/commands/adapt.js";
import { saveSkillsRegistry } from "../../src/services/registry.js";

describe("adaptCommand", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let logs: string[];
  let originalError: typeof console.error;
  let originalLog: typeof console.log;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hk-skills-adapt-test-"));
    fs.mkdirSync(path.join(tempDir, "warehouse", "local", "test-skill"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "warehouse", "local", "test-skill", "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`,
      "utf-8"
    );
    fs.mkdirSync(path.join(tempDir, "registry"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "manifests"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "manifests", "test-skill.yaml"),
      `name: test-skill\nsource:\n  type: local\n`,
      "utf-8"
    );

    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    logs = [];
    originalError = console.error;
    originalLog = console.log;
    console.error = (msg: string) => {
      logs.push(msg);
    };
    console.log = (msg: string) => {
      logs.push(msg);
    };
  });

  afterEach(() => {
    console.error = originalError;
    console.log = originalLog;
    if (exitSpy) exitSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("adapts an installed skill successfully", async () => {
    saveSkillsRegistry(tempDir, {
      "test-skill": {
        manifest: "manifests/test-skill.yaml",
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    await adaptCommand(tempDir, "test-skill");

    expect(logs.some((l) => l.includes("Adapted skill: test-skill"))).toBe(true);

    const adaptedPath = path.join(tempDir, "warehouse", "adapted", "test-skill");
    expect(fs.existsSync(adaptedPath)).toBe(true);
    expect(fs.existsSync(path.join(adaptedPath, "SKILL.md"))).toBe(true);
  });

  it("fails when skill is not installed", async () => {
    saveSkillsRegistry(tempDir, {});

    await expect(adaptCommand(tempDir, "missing-skill")).rejects.toThrow("process.exit called");

    expect(logs.some((l) => l.includes("not installed") || l.includes("not found"))).toBe(true);
  });

  it("preserves enable state when re-adapting a skill", async () => {
    saveSkillsRegistry(tempDir, {
      "test-skill": {
        manifest: "manifests/test-skill.yaml",
        installed: true,
        enabled_global: true,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    await adaptCommand(tempDir, "test-skill");

    const adaptedPath = path.join(tempDir, "warehouse", "adapted", "test-skill");
    const linkPath = path.join(tempDir, "runtime", "global", "test-skill");

    fs.mkdirSync(path.join(tempDir, "runtime", "global"), { recursive: true });
    fs.symlinkSync(adaptedPath, linkPath);

    expect(fs.existsSync(linkPath)).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(linkPath)).toBe(adaptedPath);

    await adaptCommand(tempDir, "test-skill");

    expect(logs.some((l) => l.includes("Adapted skill: test-skill"))).toBe(true);

    expect(fs.existsSync(linkPath)).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(linkPath)).toBe(adaptedPath);
  });
});
