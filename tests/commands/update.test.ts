import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse } from "yaml";
import { update, updateSkill } from "../../src/commands/update.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
  saveSourcesRegistry,
} from "../../src/services/registry.js";
import * as fetcher from "../../src/core/fetcher.js";
import * as vetter from "../../src/core/vetter.js";
import * as adapter from "../../src/core/adapter.js";
import * as activator from "../../src/core/activator.js";
import { getWarehousePath } from "../../src/utils/paths.js";

function createTempRoot(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hk-skills-update-test-"));
  fs.mkdirSync(path.join(tempDir, "registry"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "manifests"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "warehouse", "remote"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "warehouse", "adapted"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "warehouse", "local"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "runtime", "global"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "runtime", "projects"), { recursive: true });
  saveSkillsRegistry(tempDir, {});
  return tempDir;
}

function createSkillManifest(root: string, name: string, sourceType: "local" | "remote" | "adapted", overrides?: Record<string, unknown>): void {
  const manifest = {
    name,
    display_name: name,
    source: {
      type: sourceType,
      repo: sourceType === "remote" ? `https://github.com/user/${name}` : undefined,
      ref: sourceType === "remote" ? "main" : undefined,
      commit: sourceType === "remote" ? "abc123" : undefined,
      ...overrides,
    },
    status: { stage: "adapted" },
    entry: { file: "SKILL.md" },
  };
  const manifestPath = path.join(root, "manifests", `${name}.yaml`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

function createAdaptedSkill(root: string, name: string): void {
  const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);
  fs.mkdirSync(adaptedPath, { recursive: true });
  fs.writeFileSync(path.join(adaptedPath, "SKILL.md"), `# ${name}\n`, "utf-8");
}

function createRemoteSkill(root: string, name: string): void {
  const remotePath = path.join(getWarehousePath(root, "remote"), name);
  fs.mkdirSync(remotePath, { recursive: true });
  fs.writeFileSync(
    path.join(remotePath, "SKILL.md"),
    `---\nname: ${name}\n---\n\n# ${name}\n`,
    "utf-8"
  );
}

describe("update", () => {
  let tempDir: string;
  let fetchRemoteSpy: ReturnType<typeof spyOn>;
  let vetSpy: ReturnType<typeof spyOn>;
  let adaptSpy: ReturnType<typeof spyOn>;
  let enableSkillSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    tempDir = createTempRoot();
    fetchRemoteSpy = spyOn(fetcher, "fetchRemote").mockImplementation(async (_root, repoUrl) => {
      const match = repoUrl.match(/\/([^/]+)$/);
      const name = match?.[1] ?? "skill";
      return { name, repoUrl, ref: "main", commit: "def456" };
    });
    vetSpy = spyOn(vetter, "vet").mockReturnValue({ passed: true, warnings: [], errors: [] });
    adaptSpy = spyOn(adapter, "adapt").mockImplementation((inputPath, root, sourceType, repo, ref, commit) => {
      const name = path.basename(inputPath);
      const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);
      fs.mkdirSync(adaptedPath, { recursive: true });
      fs.writeFileSync(path.join(adaptedPath, "SKILL.md"), `# ${name}\n`, "utf-8");
      const manifestPath = path.join(root, "manifests", `${name}.yaml`);
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      const manifest = {
        name,
        display_name: name,
        source: { type: sourceType, repo, ref, commit },
        status: { stage: "adapted" },
        entry: { file: "SKILL.md" },
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      return { success: true, name, errors: [] };
    });
    enableSkillSpy = spyOn(activator, "enableSkill").mockImplementation(() => {});
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    fetchRemoteSpy.mockRestore();
    vetSpy.mockRestore();
    adaptSpy.mockRestore();
    enableSkillSpy.mockRestore();
    if (exitSpy) exitSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("updates a remote skill when commit changes", async () => {
    const name = "remote-skill";
    createRemoteSkill(tempDir, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, name, {});

    const manifestPath = path.join(tempDir, "manifests", `${name}.yaml`);
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = parse(manifestContent) as Record<string, unknown>;
    expect((manifest.source as Record<string, string>).commit).toBe("def456");

    const registry = loadSkillsRegistry(tempDir);
    expect(registry[name]!.updated_at).not.toBe("2024-01-01T00:00:00Z");
  });

  it("skips update when commit is unchanged", async () => {
    const name = "remote-skill";
    createRemoteSkill(tempDir, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { commit: "def456" });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    exitSpy.mockRestore();
    const adaptRestore = adaptSpy.mockRestore ? adaptSpy.mockRestore : () => {};
    adaptSpy.mockRestore();
    adaptSpy = spyOn(adapter, "adapt").mockImplementation(() => {
      throw new Error("adapt should not be called");
    });

    await update(tempDir, name, {});

    expect(adaptSpy).not.toHaveBeenCalled();

    adaptSpy.mockRestore();
    adaptSpy = spyOn(adapter, "adapt").mockImplementation((inputPath, root, sourceType, repo, ref, commit) => {
      const skillName = path.basename(inputPath);
      const adaptedPath = path.join(getWarehousePath(root, "adapted"), skillName);
      fs.mkdirSync(adaptedPath, { recursive: true });
      fs.writeFileSync(path.join(adaptedPath, "SKILL.md"), `# ${skillName}\n`, "utf-8");
      const manifestPath = path.join(root, "manifests", `${skillName}.yaml`);
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      const manifest = {
        name: skillName,
        display_name: skillName,
        source: { type: sourceType, repo, ref, commit },
        status: { stage: "adapted" },
        entry: { file: "SKILL.md" },
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      return { success: true, name: skillName, errors: [] };
    });
  });

  it("errors when updating a local skill", async () => {
    const name = "local-skill";
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "local");
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    await expect(update(tempDir, name, {})).rejects.toThrow("process.exit called");
  });

  it("rolls back on vet failure", async () => {
    const name = "remote-skill";
    createRemoteSkill(tempDir, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { commit: "abc123" });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    vetSpy.mockRestore();
    vetSpy = spyOn(vetter, "vet").mockReturnValue({
      passed: false,
      warnings: [],
      errors: ["Missing SKILL.md"],
    });

    const result = await updateSkill(tempDir, name);
    expect(result.status).toBe("failed");

    const manifestPath = path.join(tempDir, "manifests", `${name}.yaml`);
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = parse(manifestContent) as Record<string, unknown>;
    expect((manifest.source as Record<string, string>).commit).toBe("abc123");
  });

  it("updates --all iterating only remote skills", async () => {
    const remoteName = "remote-skill";
    const localName = "local-skill";

    createRemoteSkill(tempDir, remoteName);
    createAdaptedSkill(tempDir, remoteName);
    createSkillManifest(tempDir, remoteName, "remote");

    createAdaptedSkill(tempDir, localName);
    createSkillManifest(tempDir, localName, "local");

    saveSkillsRegistry(tempDir, {
      [remoteName]: {
        manifest: `manifests/${remoteName}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
      [localName]: {
        manifest: `manifests/${localName}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, undefined, { all: true });

    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, `https://github.com/user/${remoteName}`);
    expect(fetchRemoteSpy).not.toHaveBeenCalledWith(tempDir, expect.stringContaining(localName));

    const remoteManifestPath = path.join(tempDir, "manifests", `${remoteName}.yaml`);
    const remoteManifest = parse(fs.readFileSync(remoteManifestPath, "utf-8")) as Record<string, unknown>;
    expect((remoteManifest.source as Record<string, string>).commit).toBe("def456");
  });

  it("refreshes symlinks when skill is enabled globally and in projects", async () => {
    const name = "remote-skill";
    createRemoteSkill(tempDir, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: true,
        enabled_projects: ["my-app"],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, name, {});

    expect(enableSkillSpy).toHaveBeenCalledWith(tempDir, name, "global");
    expect(enableSkillSpy).toHaveBeenCalledWith(tempDir, name, { project: "my-app" });
  });

  it("falls back to git remote when manifest and sources.json repo are missing", async () => {
    const name = "remote-skill";
    createRemoteSkill(tempDir, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { repo: undefined });
    saveSourcesRegistry(tempDir, {});
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    const remotePath = path.join(tempDir, "warehouse", "remote", name);
    const { execSync } = await import("node:child_process");
    execSync(`git init "${remotePath}"`, { stdio: "ignore" });
    execSync(`git -C "${remotePath}" remote add origin https://github.com/user/${name}`, { stdio: "ignore" });

    exitSpy.mockRestore();

    await update(tempDir, name, {});

    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, `https://github.com/user/${name}`);
  });

  it("rolls back when adapt returns a different skill name", async () => {
    const name = "remote-skill";
    createRemoteSkill(tempDir, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    adaptSpy.mockRestore();
    adaptSpy = spyOn(adapter, "adapt").mockImplementation(() => {
      return { success: true, name: "renamed-skill", errors: [] };
    });

    const result = await updateSkill(tempDir, name);
    expect(result.status).toBe("failed");

    const manifestPath = path.join(tempDir, "manifests", `${name}.yaml`);
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = parse(manifestContent) as Record<string, unknown>;
    expect(manifest.name).toBe("remote-skill");
  });

  it("--all continues on failure and reports summary", async () => {
    const goodSkill = "good-skill";
    const badSkill = "bad-skill";

    createRemoteSkill(tempDir, goodSkill);
    createAdaptedSkill(tempDir, goodSkill);
    createSkillManifest(tempDir, goodSkill, "remote");

    createRemoteSkill(tempDir, badSkill);
    createAdaptedSkill(tempDir, badSkill);
    createSkillManifest(tempDir, badSkill, "remote");

    saveSkillsRegistry(tempDir, {
      [goodSkill]: {
        manifest: `manifests/${goodSkill}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
      [badSkill]: {
        manifest: `manifests/${badSkill}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    vetSpy.mockRestore();
    vetSpy = spyOn(vetter, "vet").mockImplementation((skillPath: string) => {
      if (skillPath.includes(badSkill)) {
        return { passed: false, warnings: [], errors: ["Vet failed"] };
      }
      return { passed: true, warnings: [], errors: [] };
    });

    exitSpy.mockRestore();
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(update(tempDir, undefined, { all: true })).rejects.toThrow("process.exit called");

    const goodManifestPath = path.join(tempDir, "manifests", `${goodSkill}.yaml`);
    const goodManifest = parse(fs.readFileSync(goodManifestPath, "utf-8")) as Record<string, unknown>;
    expect((goodManifest.source as Record<string, string>).commit).toBe("def456");

    const badManifestPath = path.join(tempDir, "manifests", `${badSkill}.yaml`);
    const badManifest = parse(fs.readFileSync(badManifestPath, "utf-8")) as Record<string, unknown>;
    expect((badManifest.source as Record<string, string>).commit).toBe("abc123");
  });

  it("falls back to sources.json when manifest repo is missing", async () => {
    const name = "remote-skill";
    createRemoteSkill(tempDir, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { repo: undefined });
    saveSourcesRegistry(tempDir, {
      [name]: [{ repo: "https://github.com/fallback/repo", ref: "develop" }],
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, name, {});

    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, "https://github.com/fallback/repo");
  });
});
