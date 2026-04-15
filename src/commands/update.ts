import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { parse } from "yaml";
import { fetchRemote } from "../core/fetcher.js";
import { vet } from "../core/vetter.js";
import { adapt } from "../core/adapter.js";
import { enableSkill } from "../core/activator.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
} from "../services/registry.js";
import { getManifestPath, getWarehousePath } from "../utils/paths.js";
import { info, warn, error, success } from "../utils/logger.js";
import { SkillManifestSchema, type SkillManifest } from "../models/manifest.js";

function loadManifest(root: string, name: string): SkillManifest | null {
  const manifestPath = getManifestPath(root, name);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    const parsed = parse(content);
    return SkillManifestSchema.parse(parsed);
  } catch {
    return null;
  }
}

function resolveRemoteUrl(
  root: string,
  name: string,
  manifest: SkillManifest
): string | null {
  if (typeof manifest.source?.repo === "string" && manifest.source.repo.length > 0) {
    return manifest.source.repo;
  }

  const sources = loadSourcesRegistry(root);
  const entries = sources[name];
  const firstEntry = entries?.[0];
  if (firstEntry && typeof firstEntry.repo === "string") {
    return firstEntry.repo;
  }

  const remotePath = path.join(getWarehousePath(root, "remote"), name);
  if (fs.existsSync(remotePath)) {
    try {
      const output = execSync(`git -C "${remotePath}" remote get-url origin`, {
        encoding: "utf-8",
      }).trim();
      if (output) return output;
    } catch (err) {
      warn(`Failed to read git remote for "${name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return null;
}

function resolveRef(
  root: string,
  name: string,
  manifest: SkillManifest
): string {
  if (typeof manifest.source?.ref === "string" && manifest.source.ref.length > 0) {
    return manifest.source.ref;
  }

  const sources = loadSourcesRegistry(root);
  const entries = sources[name];
  const firstEntry = entries?.[0];
  if (firstEntry && typeof firstEntry.ref === "string") {
    return firstEntry.ref;
  }

  return "main";
}

function backupSkill(root: string, name: string): { adaptedBackup: string; manifestBackup: string } {
  const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);
  const manifestPath = getManifestPath(root, name);

  const timestamp = Date.now();
  const adaptedBackup = `${adaptedPath}.backup.${timestamp}`;
  const manifestBackup = `${manifestPath}.backup.${timestamp}`;

  if (fs.existsSync(adaptedPath)) {
    fs.cpSync(adaptedPath, adaptedBackup, { recursive: true });
  }
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, manifestBackup);
  }

  return { adaptedBackup, manifestBackup };
}

function restoreBackup(
  root: string,
  name: string,
  adaptedBackup: string,
  manifestBackup: string
): void {
  const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);
  const manifestPath = getManifestPath(root, name);

  if (fs.existsSync(adaptedBackup)) {
    if (fs.existsSync(adaptedPath)) {
      fs.rmSync(adaptedPath, { recursive: true, force: true });
    }
    fs.cpSync(adaptedBackup, adaptedPath, { recursive: true });
  }
  if (fs.existsSync(manifestBackup)) {
    fs.copyFileSync(manifestBackup, manifestPath);
  }
}

function cleanupBackup(adaptedBackup: string, manifestBackup: string): void {
  if (fs.existsSync(adaptedBackup)) {
    fs.rmSync(adaptedBackup, { recursive: true, force: true });
  }
  if (fs.existsSync(manifestBackup)) {
    fs.unlinkSync(manifestBackup);
  }
}

export async function updateSkill(
  root: string,
  name: string
): Promise<{ status: "updated" | "skipped" | "failed"; message?: string }> {
  const registry = loadSkillsRegistry(root);
  const entry = registry[name];
  if (!entry || !entry.installed) {
    error(`Skill "${name}" is not installed`);
    process.exit(1);
  }

  const manifest = loadManifest(root, name);
  if (!manifest) {
    error(`Manifest for skill "${name}" not found`);
    process.exit(1);
  }

  if (manifest.source?.type !== "remote") {
    error(`Skill "${name}" is not a remote skill and cannot be updated`);
    process.exit(1);
  }

  const repoUrl = resolveRemoteUrl(root, name, manifest);
  if (!repoUrl) {
    error(
      `Cannot determine remote URL for skill "${name}". Please remove and reinstall it to enable updates.`
    );
    process.exit(1);
  }

  const ref = resolveRef(root, name, manifest);

  let fetchResult;
  try {
    fetchResult = await fetchRemote(root, repoUrl);
  } catch (err) {
    error(
      `Fetch failed for "${name}": ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  const currentCommit = manifest.source?.commit;
  if (currentCommit && currentCommit === fetchResult.commit) {
    info(`Skill "${name}" is already up to date`);
    return { status: "skipped" };
  }

  const { adaptedBackup, manifestBackup } = backupSkill(root, name);

  try {
    const vetResult = vet(path.join(getWarehousePath(root, "remote"), name));
    if (!vetResult.passed) {
      throw new Error(vetResult.errors.join(", "));
    }

    const adaptResult = adapt(
      path.join(getWarehousePath(root, "remote"), name),
      root,
      "remote",
      repoUrl,
      ref,
      fetchResult.commit
    );
    if (!adaptResult.success) {
      throw new Error(adaptResult.errors.join(", "));
    }

    if (adaptResult.name !== name) {
      throw new Error(
        `Skill name mismatch after update: expected "${name}", got "${adaptResult.name}"`
      );
    }

    entry.updated_at = new Date().toISOString();
    saveSkillsRegistry(root, registry);

    if (entry.enabled_global) {
      enableSkill(root, name, "global");
    }
    for (const project of entry.enabled_projects) {
      enableSkill(root, name, { project });
    }

    cleanupBackup(adaptedBackup, manifestBackup);
    success(`Updated skill: ${name}`);
    return { status: "updated" };
  } catch (err) {
    restoreBackup(root, name, adaptedBackup, manifestBackup);
    cleanupBackup(adaptedBackup, manifestBackup);
    error(
      `Update failed for "${name}": ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function update(
  root: string,
  name: string | undefined,
  options: { all?: boolean }
): Promise<void> {
  if (options.all) {
    const registry = loadSkillsRegistry(root);
    const remoteSkills = Object.entries(registry)
      .filter(([_, entry]) => entry.installed)
      .map(([skillName]) => skillName)
      .filter((skillName) => {
        const manifest = loadManifest(root, skillName);
        return manifest?.source?.type === "remote";
      });

    if (remoteSkills.length === 0) {
      info("No remote skills to update.");
      return;
    }

    const results: {
      updated: string[];
      skipped: string[];
      failed: { name: string; message?: string }[];
    } = { updated: [], skipped: [], failed: [] };

    for (const skillName of remoteSkills) {
      const result = await updateSkill(root, skillName);
      if (result.status === "updated") {
        results.updated.push(skillName);
      } else if (result.status === "skipped") {
        results.skipped.push(skillName);
      } else {
        results.failed.push({ name: skillName, message: result.message });
      }
    }

    if (results.updated.length > 0) {
      success(`Updated ${results.updated.length} skill(s): ${results.updated.join(", ")}`);
    }
    if (results.skipped.length > 0) {
      info(`Skipped ${results.skipped.length} skill(s): ${results.skipped.join(", ")}`);
    }
    if (results.failed.length > 0) {
      error(
        `Failed to update ${results.failed.length} skill(s): ${results.failed
          .map((f) => `${f.name}${f.message ? ` (${f.message})` : ""}`)
          .join(", ")}`
      );
      process.exit(1);
    }

    return;
  }

  if (name === undefined) {
    error("Must specify either a skill name or --all");
    process.exit(1);
  }

  const result = await updateSkill(root, name);
  if (result.status === "failed") {
    process.exit(1);
  }
}
