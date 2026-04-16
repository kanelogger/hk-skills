import fs from "node:fs";
import path from "node:path";
import { safeDisableAll, promptConfirm } from "./remove.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  saveSourcesRegistry,
  saveProjectsRegistry,
} from "../services/registry.js";
import { success } from "../utils/logger.js";

const DIRS = [
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

export function ensureManagedDirs(root: string): void {
  for (const dir of DIRS) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
}

function clearDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function clearTempAndBackupFiles(dirPath: string): void {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return;
  }
  for (const entry of fs.readdirSync(dirPath)) {
    if (entry.startsWith(".") && (entry.includes(".backup.") || entry.includes(".tmp."))) {
      fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
    }
  }
}

export async function reset(
  root: string,
  options: { yes?: boolean; promptConfirm?: (msg: string) => Promise<boolean> } = {}
): Promise<void> {
  const confirmFn = options.promptConfirm ?? promptConfirm;

  if (!options.yes) {
    const confirmed = await confirmFn("Reset all HK Skills project state?");
    if (!confirmed) {
      return;
    }
  }

  const skills = loadSkillsRegistry(root);
  for (const name of Object.keys(skills)) {
    safeDisableAll(root, name);
  }

  clearDir(path.join(root, "manifests"));
  clearDir(path.join(root, "warehouse", "adapted"));
  clearDir(path.join(root, "warehouse", "remote"));
  clearDir(path.join(root, "runtime", "global"));
  clearDir(path.join(root, "runtime", "projects"));
  clearDir(path.join(root, "logs"));
  clearDir(path.join(root, "patches"));

  const catalogPath = path.join(root, "docs", "catalog.md");
  if (fs.existsSync(catalogPath)) {
    fs.unlinkSync(catalogPath);
  }

  const registryDir = path.join(root, "registry");
  clearTempAndBackupFiles(registryDir);
  clearTempAndBackupFiles(path.join(root, "manifests"));
  clearTempAndBackupFiles(path.join(root, "warehouse", "adapted"));
  clearTempAndBackupFiles(path.join(root, "warehouse", "remote"));

  saveSkillsRegistry(root, {});
  saveSourcesRegistry(root, {});
  saveProjectsRegistry(root, {});

  ensureManagedDirs(root);

  success("Reset complete. Project state has been cleared.");
}
