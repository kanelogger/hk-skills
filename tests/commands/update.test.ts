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
import { getWarehousePath, canonicalizeProjectId } from "../../src/utils/paths.js";
import { generateSourceId } from "../../src/core/fetcher.js";

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

function createRemoteSkill(root: string, source_id: string, name?: string, subpath?: string): string {
  const remoteBase = path.join(getWarehousePath(root, "remote"), source_id);
  const remotePath = subpath ? path.join(remoteBase, subpath) : remoteBase;
  fs.mkdirSync(remotePath, { recursive: true });
  const skillName = name ?? "skill";
  fs.writeFileSync(
    path.join(remotePath, "SKILL.md"),
    `---\nname: ${skillName}\n---\n\n# ${skillName}\n`,
    "utf-8"
  );
  return remotePath;
}

describe("update", () => {
  let tempDir: string;
  let fetchRemoteSpy: ReturnType<typeof spyOn>;
  let vetSpy: ReturnType<typeof spyOn>;
  let adaptSpy: ReturnType<typeof spyOn>;
  let enableSkillSpy: ReturnType<typeof spyOn>;
  let refreshSkillLinksSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = createTempRoot();
    process.chdir(tempDir);
    fetchRemoteSpy = spyOn(fetcher, "fetchRemote").mockImplementation(async (_root, repoUrl, ref = "main") => {
      const match = repoUrl.match(/\/([^/]+)$/);
      const name = match?.[1] ?? "skill";
      const source_id = generateSourceId(repoUrl, ref);
      return { source_id, name, repoUrl, ref, commit: "def456" };
    });
    vetSpy = spyOn(vetter, "vet").mockReturnValue({ passed: true, warnings: [], errors: [] });
    adaptSpy = spyOn(adapter, "adapt").mockImplementation((inputPath, root, sourceType, repo, ref, commit) => {
      let name = path.basename(inputPath);
      const skillMdPath = path.join(inputPath, "SKILL.md");
      if (fs.existsSync(skillMdPath)) {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const match = content.match(/^---\nname:\s*(.+)\n---/m);
        if (match) {
          name = match[1]?.trim() ?? name;
        }
      }
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
    refreshSkillLinksSpy = spyOn(activator, "refreshSkillLinks").mockImplementation(() => {});
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    fetchRemoteSpy.mockRestore();
    vetSpy.mockRestore();
    adaptSpy.mockRestore();
    enableSkillSpy.mockRestore();
    refreshSkillLinksSpy.mockRestore();
    if (exitSpy) exitSpy.mockRestore();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("updates a remote skill when commit changes", async () => {
    const name = "remote-skill";
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: `https://github.com/user/${name}`, ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
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
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { commit: "def456" });
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: `https://github.com/user/${name}`, ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
      },
    });

    exitSpy.mockRestore();
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
    const source_id = `local-${name}`;
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "local");
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "local", local_path: `warehouse/local/${name}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
      },
    });

    await expect(update(tempDir, name, {})).rejects.toThrow("process.exit called");
  });

  it("rolls back on vet failure", async () => {
    const name = "remote-skill";
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { commit: "abc123" });
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: `https://github.com/user/${name}`, ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
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
    const remoteSourceId = generateSourceId(`https://github.com/user/${remoteName}`, "main");

    createRemoteSkill(tempDir, remoteSourceId, remoteName);
    createAdaptedSkill(tempDir, remoteName);
    createSkillManifest(tempDir, remoteName, "remote");

    createAdaptedSkill(tempDir, localName);
    createSkillManifest(tempDir, localName, "local");

    saveSourcesRegistry(tempDir, {
      [remoteSourceId]: { type: "remote", repo: `https://github.com/user/${remoteName}`, ref: "main", local_path: `warehouse/remote/${remoteSourceId}` },
      [`local-${localName}`]: { type: "local", local_path: `warehouse/local/${localName}` },
    });

    saveSkillsRegistry(tempDir, {
      [remoteName]: {
        manifest: `manifests/${remoteName}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id: remoteSourceId,
      },
      [localName]: {
        manifest: `manifests/${localName}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id: `local-${localName}`,
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, undefined, { all: true });

    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, `https://github.com/user/${remoteName}`, "main");
    expect(fetchRemoteSpy).not.toHaveBeenCalledWith(tempDir, expect.stringContaining(localName), expect.anything());

    const remoteManifestPath = path.join(tempDir, "manifests", `${remoteName}.yaml`);
    const remoteManifest = parse(fs.readFileSync(remoteManifestPath, "utf-8")) as Record<string, unknown>;
    expect((remoteManifest.source as Record<string, string>).commit).toBe("def456");
  });

  it("refreshes symlinks when skill is enabled globally and in projects", async () => {
    const name = "remote-skill";
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: `https://github.com/user/${name}`, ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: true,
        enabled_projects: ["my-app"],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
      },
    });

    exitSpy.mockRestore();
    enableSkillSpy.mockRestore();
    refreshSkillLinksSpy.mockRestore();

    fs.mkdirSync(path.join(tempDir, "runtime", "global"), { recursive: true });
    fs.symlinkSync(path.join(getWarehousePath(tempDir, "adapted"), name), path.join(tempDir, "runtime", "global", name));
    fs.mkdirSync(path.join(tempDir, "runtime", "projects", "my-app"), { recursive: true });
    fs.symlinkSync(path.join(getWarehousePath(tempDir, "adapted"), name), path.join(tempDir, "runtime", "projects", "my-app", name));
    fs.mkdirSync(path.join(tempDir, "my-app", ".agents", "skills"), { recursive: true });
    fs.symlinkSync(path.join(getWarehousePath(tempDir, "adapted"), name), path.join(tempDir, "my-app", ".agents", "skills", name));

    await update(tempDir, name, {});

    expect(fs.existsSync(path.join(tempDir, "runtime", "global", name))).toBe(true);
    expect(fs.lstatSync(path.join(tempDir, "runtime", "global", name)).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "runtime", "projects", "my-app", name))).toBe(true);
    expect(fs.lstatSync(path.join(tempDir, "runtime", "projects", "my-app", name)).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "my-app", ".agents", "skills", name))).toBe(true);
    expect(fs.lstatSync(path.join(tempDir, "my-app", ".agents", "skills", name)).isSymbolicLink()).toBe(true);
  });

  it("re-creates project-scoped symlinks in canonical runtime directory during update", async () => {
    const name = "remote-skill";
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "hk-skills-update-project-"));
    const canonicalId = canonicalizeProjectId(projectPath);
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: `https://github.com/user/${name}`, ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [canonicalId],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
      },
    });

    exitSpy.mockRestore();
    enableSkillSpy.mockRestore();
    refreshSkillLinksSpy.mockRestore();

    const canonicalRuntimeDir = path.join(tempDir, "runtime", "projects", canonicalId);
    fs.mkdirSync(canonicalRuntimeDir, { recursive: true });
    fs.symlinkSync(path.join(getWarehousePath(tempDir, "adapted"), name), path.join(canonicalRuntimeDir, name));
    fs.mkdirSync(path.join(projectPath, ".agents", "skills"), { recursive: true });
    fs.symlinkSync(path.join(getWarehousePath(tempDir, "adapted"), name), path.join(projectPath, ".agents", "skills", name));

    await update(tempDir, name, {});

    expect(fs.existsSync(path.join(tempDir, "runtime", "projects", canonicalId, name))).toBe(true);
    expect(fs.lstatSync(path.join(tempDir, "runtime", "projects", canonicalId, name)).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".agents", "skills", name))).toBe(true);
    expect(fs.lstatSync(path.join(projectPath, ".agents", "skills", name)).isSymbolicLink()).toBe(true);

    fs.rmSync(projectPath, { recursive: true, force: true });
  });

  it("skips legacy raw project paths during update without migrating them", async () => {
    const name = "remote-skill";
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    const projectPath = "/absolute/path/to/my-app";
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: `https://github.com/user/${name}`, ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [projectPath],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
      },
    });

    exitSpy.mockRestore();
    enableSkillSpy.mockRestore();
    refreshSkillLinksSpy.mockRestore();

    await update(tempDir, name, {});

    const canonicalId = canonicalizeProjectId(projectPath);
    expect(fs.existsSync(path.join(tempDir, "runtime", "projects", projectPath, name))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "runtime", "projects", canonicalId, name))).toBe(false);

    const registry = loadSkillsRegistry(tempDir);
    expect(registry[name]!.enabled_projects).toEqual([projectPath]);
  });

  it("falls back to git remote when manifest and sources.json repo are missing", async () => {
    const name = "remote-skill";
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { repo: undefined });
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
      },
    });

    const remotePath = path.join(tempDir, "warehouse", "remote", source_id);
    const { execSync } = await import("node:child_process");
    execSync(`git init "${remotePath}"`, { stdio: "ignore" });
    execSync(`git -C "${remotePath}" remote add origin https://github.com/user/${name}`, { stdio: "ignore" });

    exitSpy.mockRestore();

    await update(tempDir, name, {});

    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, `https://github.com/user/${name}`, "main");
  });

  it("rolls back when adapt returns a different skill name", async () => {
    const name = "remote-skill";
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote");
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: `https://github.com/user/${name}`, ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
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
    const goodSourceId = generateSourceId(`https://github.com/user/${goodSkill}`, "main");
    const badSourceId = generateSourceId(`https://github.com/user/${badSkill}`, "main");

    createRemoteSkill(tempDir, goodSourceId, goodSkill);
    createAdaptedSkill(tempDir, goodSkill);
    createSkillManifest(tempDir, goodSkill, "remote");

    createRemoteSkill(tempDir, badSourceId, badSkill);
    createAdaptedSkill(tempDir, badSkill);
    createSkillManifest(tempDir, badSkill, "remote");

    saveSourcesRegistry(tempDir, {
      [goodSourceId]: { type: "remote", repo: `https://github.com/user/${goodSkill}`, ref: "main", local_path: `warehouse/remote/${goodSourceId}` },
      [badSourceId]: { type: "remote", repo: `https://github.com/user/${badSkill}`, ref: "main", local_path: `warehouse/remote/${badSourceId}` },
    });

    saveSkillsRegistry(tempDir, {
      [goodSkill]: {
        manifest: `manifests/${goodSkill}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id: goodSourceId,
      },
      [badSkill]: {
        manifest: `manifests/${badSkill}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id: badSourceId,
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
    const source_id = generateSourceId(`https://github.com/user/${name}`, "main");
    createRemoteSkill(tempDir, source_id, name);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { repo: undefined, ref: undefined });
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: "https://github.com/fallback/repo", ref: "develop", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, name, {});

    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, "https://github.com/fallback/repo", "develop");
  });

  it("updates a skill with subpath by vetting and adapting the subpath directory", async () => {
    const name = "sub-skill";
    const source_id = "mono-source";
    const subpath = "packages/sub-skill";
    createRemoteSkill(tempDir, source_id, name, subpath);
    createAdaptedSkill(tempDir, name);
    createSkillManifest(tempDir, name, "remote", { repo: undefined });
    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: "https://github.com/user/mono-repo", ref: "main", local_path: `warehouse/remote/${source_id}` },
    });
    saveSkillsRegistry(tempDir, {
      [name]: {
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
        subpath,
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, name, {});

    const expectedPath = path.join(getWarehousePath(tempDir, "remote"), source_id, subpath);
    expect(vetSpy).toHaveBeenCalledWith(expectedPath);
    expect(adaptSpy).toHaveBeenCalledWith(expectedPath, tempDir, "remote", "https://github.com/user/mono-repo", "main", "def456");
  });

  it("fetches shared source only once during --all when two skills share a source", async () => {
    const skillA = "skill-a";
    const skillB = "skill-b";
    const source_id = "shared-source";

    createRemoteSkill(tempDir, source_id, skillA, "packages/skill-a");
    createRemoteSkill(tempDir, source_id, skillB, "packages/skill-b");
    createAdaptedSkill(tempDir, skillA);
    createAdaptedSkill(tempDir, skillB);
    createSkillManifest(tempDir, skillA, "remote", { repo: "https://github.com/user/shared-repo" });
    createSkillManifest(tempDir, skillB, "remote", { repo: "https://github.com/user/shared-repo" });

    saveSourcesRegistry(tempDir, {
      [source_id]: { type: "remote", repo: "https://github.com/user/shared-repo", ref: "main", local_path: `warehouse/remote/${source_id}` },
    });

    saveSkillsRegistry(tempDir, {
      [skillA]: {
        manifest: `manifests/${skillA}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
        subpath: "packages/skill-a",
      },
      [skillB]: {
        manifest: `manifests/${skillB}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: "2024-01-01T00:00:00Z",
        source_id,
        subpath: "packages/skill-b",
      },
    });

    exitSpy.mockRestore();

    await update(tempDir, undefined, { all: true });

    expect(fetchRemoteSpy).toHaveBeenCalledTimes(1);
    expect(fetchRemoteSpy).toHaveBeenCalledWith(tempDir, "https://github.com/user/shared-repo", "main");
  });
});
