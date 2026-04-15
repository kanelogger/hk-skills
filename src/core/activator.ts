import fs from "node:fs";
import path from "node:path";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
} from "../services/registry.js";
import { getWarehousePath, getRuntimePath } from "../utils/paths.js";

export function resolveSourcePath(root: string, name: string): string {
  const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);
  if (fs.existsSync(adaptedPath)) {
    return adaptedPath;
  }
  const localPath = path.join(getWarehousePath(root, "local"), name);
  if (fs.existsSync(localPath)) {
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
  return entry.enabled_projects.includes(scope.project);
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
  fs.symlinkSync(sourcePath, linkPath);

  if (scope === "global") {
    entry.enabled_global = true;
  } else {
    if (!entry.enabled_projects.includes(scope.project)) {
      entry.enabled_projects.push(scope.project);
    }
  }
  entry.updated_at = new Date().toISOString();

  saveSkillsRegistry(root, registry);
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

  if (fs.existsSync(linkPath)) {
    const lstat = fs.lstatSync(linkPath);
    if (lstat.isSymbolicLink()) {
      fs.unlinkSync(linkPath);
    } else {
      throw new Error(
        `Path "${linkPath}" exists but is not a symbolic link`
      );
    }
  }

  if (scope === "global") {
    entry.enabled_global = false;
  } else {
    entry.enabled_projects = entry.enabled_projects.filter(
      (p) => p !== scope.project
    );
  }
  entry.updated_at = new Date().toISOString();

  saveSkillsRegistry(root, registry);
}
