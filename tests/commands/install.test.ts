import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { install } from "../../src/commands/install.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
} from "../../src/services/registry.js";
import * as fetcher from "../../src/core/fetcher.js";
import * as vetter from "../../src/core/vetter.js";
import { getWarehousePath } from "../../src/utils/paths.js";

function createTempRoot(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hk-skills-install-test-"));
  fs.mkdirSync(path.join(tempDir, "registry"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "manifests"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "warehouse", "remote"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "warehouse", "local"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "warehouse", "adapted"), { recursive: true });
  saveSkillsRegistry(tempDir, {});
  return tempDir;
}

describe("install", () => {
  let tempDir: string;
  let fetchRemoteSpy: ReturnType<typeof spyOn>;
  let fetchLocalSpy: ReturnType<typeof spyOn>;
  let vetSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    tempDir = createTempRoot();
    fetchRemoteSpy = spyOn(fetcher, "fetchRemote").mockImplementation(async (root, repoUrl) => {
      const name = "test-remote-skill";
      const targetPath = path.join(getWarehousePath(root, "remote"), name);
      fs.mkdirSync(targetPath, { recursive: true });
      fs.writeFileSync(
        path.join(targetPath, "SKILL.md"),
        `---\nname: ${name}\n---\n\n# ${name}\n`,
        "utf-8"
      );
      return { name, repoUrl, ref: "main", commit: "abc123" };
    });
    fetchLocalSpy = spyOn(fetcher, "fetchLocal").mockImplementation(async (root, localPath) => {
      const name = path.basename(localPath);
      const targetPath = path.join(getWarehousePath(root, "local"), name);
      fs.mkdirSync(targetPath, { recursive: true });
      fs.writeFileSync(
        path.join(targetPath, "SKILL.md"),
        `---\nname: ${name}\n---\n\n# ${name}\n`,
        "utf-8"
      );
      return name;
    });
    vetSpy = spyOn(vetter, "vet").mockRestore();
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    fetchRemoteSpy.mockRestore();
    fetchLocalSpy.mockRestore();
    if (vetSpy) vetSpy.mockRestore();
    if (exitSpy) exitSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("installs from remote URL and registers skill", async () => {
    vetSpy.mockRestore();
    exitSpy.mockRestore();

    await install(tempDir, "https://github.com/example/test-remote-skill.git");

    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, "https://github.com/example/test-remote-skill.git");

    const registry = loadSkillsRegistry(tempDir);
    expect(registry["test-remote-skill"]).toBeDefined();
    expect(registry["test-remote-skill"]!.installed).toBe(true);
    expect(registry["test-remote-skill"]!.manifest).toBe("manifests/test-remote-skill.yaml");

    const sources = loadSourcesRegistry(tempDir);
    expect(sources["test-remote-skill"]).toEqual([
      { repo: "https://github.com/example/test-remote-skill.git", ref: "main" },
    ]);

    const manifestPath = path.join(tempDir, "manifests", "test-remote-skill.yaml");
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    expect(manifestContent).toContain("commit: abc123");
  });

  it("installs from local path and registers skill", async () => {
    const localSkillPath = path.join(tempDir, "my-local-skill");
    fs.mkdirSync(localSkillPath, { recursive: true });
    fs.writeFileSync(
      path.join(localSkillPath, "SKILL.md"),
      `---\nname: my-local-skill\n---\n\n# my-local-skill\n`,
      "utf-8"
    );
    vetSpy.mockRestore();
    exitSpy.mockRestore();

    await install(tempDir, localSkillPath, { local: true });

    expect(fetchLocalSpy).toHaveBeenCalledWith(tempDir, localSkillPath);

    const registry = loadSkillsRegistry(tempDir);
    expect(registry["my-local-skill"]).toBeDefined();
    expect(registry["my-local-skill"]!.installed).toBe(true);
  });

  it("rolls back fetched directory when vet fails", async () => {
    vetSpy = spyOn(vetter, "vet").mockReturnValue({
      passed: false,
      warnings: [],
      errors: ["Missing SKILL.md"],
    });

    const fetchedPath = path.join(getWarehousePath(tempDir, "remote"), "test-remote-skill");

    await expect(
      install(tempDir, "https://github.com/example/test-remote-skill.git")
    ).rejects.toThrow("process.exit called");

    expect(fs.existsSync(fetchedPath)).toBe(false);
  });

  it("skips registration if skill already exists in registry", async () => {
    vetSpy.mockRestore();
    exitSpy.mockRestore();

    saveSkillsRegistry(tempDir, {
      "test-remote-skill": {
        manifest: "manifests/test-remote-skill.yaml",
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    await install(tempDir, "https://github.com/example/test-remote-skill.git");

    const registry = loadSkillsRegistry(tempDir);
    expect(registry["test-remote-skill"]!.updated_at).toBe("2024-01-01T00:00:00Z");
  });
});
