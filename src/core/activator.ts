import fs from "node:fs";
import path from "node:path";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
} from "../services/registry.js";
import {
  getWarehousePath,
  getRuntimePath,
  canonicalizeProjectId,
  getProjectAgentsSkillsPath,
} from "../utils/paths.js";

export function resolveSourcePath(root: string, name: string): string {
  const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);
  if (fs.existsSync(path.join(adaptedPath, "SKILL.md"))) {
    return adaptedPath;
  }
  const localPath = path.join(getWarehousePath(root, "local"), name);
  if (fs.existsSync(path.join(localPath, "SKILL.md"))) {
    return localPath;
  }
  throw new Error(
    `Skill source not found for "${name}" in warehouse/adapted or warehouse/local`
  );
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isEnabled(
  registry: import("../models/registry.js").SkillsRegistry,
  name: string,
  scope: "global" | { project: string }
): boolean {
  const entry = registry[name];
  if (!entry) return false;
  if (scope === "global") {
    return entry.enabled_global;
  }
  return entry.enabled_projects.includes(canonicalizeProjectId(scope.project));
}

function ensureSymlink(sourcePath: string, linkPath: string): void {
  let lstat: fs.Stats | undefined;
  try {
    lstat = fs.lstatSync(linkPath);
  } catch {}

  if (lstat) {
    if (!lstat.isSymbolicLink()) {
      throw new Error(`Path "${linkPath}" exists but is not a symbolic link`);
    }
    const existingTarget = fs.readlinkSync(linkPath);
    if (existingTarget !== sourcePath) {
      throw new Error(
        `Symlink "${linkPath}" already exists and points to "${existingTarget}" instead of "${sourcePath}"`
      );
    }
  } else {
    fs.symlinkSync(sourcePath, linkPath);
  }
}

function removeSymlink(linkPath: string): void {
  let lstat: fs.Stats | undefined;
  try {
    lstat = fs.lstatSync(linkPath);
  } catch {}

  if (lstat) {
    if (!lstat.isSymbolicLink()) {
      throw new Error(`Path "${linkPath}" exists but is not a symbolic link`);
    }
    fs.unlinkSync(linkPath);
  }
}

export function enableSkill(
  root: string,
  name: string,
  scope: "global" | { project: string }
): void {
  const registry = loadSkillsRegistry(root);
  const entry = registry[name];

  if (!entry || !entry.installed) {
    throw new Error(`Skill "${name}" is not installed`);
  }

  if (isEnabled(registry, name, scope)) {
    return;
  }

  const sourcePath = resolveSourcePath(root, name);
  const runtimeDir = getRuntimePath(root, scope);
  ensureDir(runtimeDir);

  const linkPath = path.join(runtimeDir, name);
  ensureSymlink(sourcePath, linkPath);

  if (scope !== "global") {
    const agentsSkillsDir = getProjectAgentsSkillsPath(scope.project);
    ensureDir(agentsSkillsDir);
    const agentsLinkPath = path.join(agentsSkillsDir, name);
    ensureSymlink(sourcePath, agentsLinkPath);
  }

  if (scope === "global") {
    entry.enabled_global = true;
  } else {
    const canonicalProject = canonicalizeProjectId(scope.project);
    if (!entry.enabled_projects.includes(canonicalProject)) {
      entry.enabled_projects.push(canonicalProject);
    }
  }
  entry.updated_at = new Date().toISOString();

  saveSkillsRegistry(root, registry);
}

export function refreshSkillLinks(
  root: string,
  name: string,
  scope: "global" | { project: string }
): void {
  const sourcePath = resolveSourcePath(root, name);
  const runtimeDir = getRuntimePath(root, scope);
  ensureDir(runtimeDir);

  const linkPath = path.join(runtimeDir, name);
  removeSymlink(linkPath);
  ensureSymlink(sourcePath, linkPath);

  if (scope !== "global") {
    const agentsSkillsDir = getProjectAgentsSkillsPath(scope.project);
    ensureDir(agentsSkillsDir);
    const agentsLinkPath = path.join(agentsSkillsDir, name);
    removeSymlink(agentsLinkPath);
    ensureSymlink(sourcePath, agentsLinkPath);
  }
}

export function disableSkill(
  root: string,
  name: string,
  scope: "global" | { project: string }
): void {
  const registry = loadSkillsRegistry(root);
  const entry = registry[name];

  if (!entry || !isEnabled(registry, name, scope)) {
    throw new Error(`Skill "${name}" is not enabled for the given scope`);
  }

  const runtimeDir = getRuntimePath(root, scope);
  const linkPath = path.join(runtimeDir, name);
  removeSymlink(linkPath);

  if (scope !== "global") {
    const agentsSkillsDir = getProjectAgentsSkillsPath(scope.project);
    const agentsLinkPath = path.join(agentsSkillsDir, name);
    removeSymlink(agentsLinkPath);
  }

  if (scope === "global") {
    entry.enabled_global = false;
  } else {
    const canonicalProject = canonicalizeProjectId(scope.project);
    entry.enabled_projects = entry.enabled_projects.filter(
      (p) => p !== canonicalProject
    );
  }
  entry.updated_at = new Date().toISOString();

  saveSkillsRegistry(root, registry);
}
