import path from "node:path";
import fs from "node:fs";
import { fetchRemote, fetchLocal } from "../core/fetcher.js";
import { vet } from "../core/vetter.js";
import { adapt } from "../core/adapter.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
  saveSourcesRegistry,
} from "../services/registry.js";
import { getWarehousePath } from "../utils/paths.js";
import { success, error, warn } from "../utils/logger.js";

export async function install(root: string, source: string, options?: { local?: boolean }): Promise<void> {
  const isRemote = !options?.local && /^https?:\/\//i.test(source);

  let name: string;
  let fetchedPath: string;
  let sourceType: "remote" | "local";
  let repoUrl: string | undefined;
  let ref: string | undefined;
  let commit: string | undefined;

  try {
    if (isRemote) {
      const fetchResult = await fetchRemote(root, source);
      name = fetchResult.name;
      repoUrl = fetchResult.repoUrl;
      ref = fetchResult.ref;
      commit = fetchResult.commit;
      fetchedPath = path.join(getWarehousePath(root, "remote"), name);
      sourceType = "remote";
    } else {
      name = await fetchLocal(root, source);
      fetchedPath = path.join(getWarehousePath(root, "local"), name);
      sourceType = "local";
    }
  } catch (err) {
    error(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const vetResult = vet(fetchedPath);
  if (!vetResult.passed) {
    error(`Vet failed for ${name}: ${vetResult.errors.join(", ")}`);
    try {
      fs.rmSync(fetchedPath, { recursive: true, force: true });
    } catch {
      warn(`Failed to clean up ${fetchedPath}`);
    }
    process.exit(1);
  }

  const adaptResult =
    sourceType === "remote"
      ? adapt(fetchedPath, root, sourceType, repoUrl, ref, commit)
      : adapt(fetchedPath, root, sourceType);
  if (!adaptResult.success) {
    error(`Adapt failed for ${name}: ${adaptResult.errors.join(", ")}`);
    try {
      fs.rmSync(fetchedPath, { recursive: true, force: true });
    } catch {
      warn(`Failed to clean up ${fetchedPath}`);
    }
    process.exit(1);
  }

  const registry = loadSkillsRegistry(root);

  if (registry[adaptResult.name]) {
    warn(`Skill ${adaptResult.name} already in registry, skipping registration`);
    return;
  }

  registry[adaptResult.name] = {
    manifest: `manifests/${adaptResult.name}.yaml`,
    installed: true,
    enabled_global: false,
    enabled_projects: [],
    updated_at: new Date().toISOString(),
  };

  saveSkillsRegistry(root, registry);

  if (sourceType === "remote" && repoUrl && ref) {
    const sources = loadSourcesRegistry(root);
    sources[adaptResult.name] = [{ repo: repoUrl, ref }];
    saveSourcesRegistry(root, sources);
  }

  success(`Installed skill: ${adaptResult.name}`);
}
