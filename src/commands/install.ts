import path from "node:path";
import fs from "node:fs";
import { fetchRemote, fetchLocal } from "../core/fetcher.js";
import { vet } from "../core/vetter.js";
import { adapt } from "../core/adapter.js";
import { discoverSkills } from "../core/discover-skills.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
  saveSourcesRegistry,
} from "../services/registry.js";
import { getWarehousePath } from "../utils/paths.js";
import { success, error, warn, info } from "../utils/logger.js";
import { promptSelectSkill } from "../utils/select-skill.js";

export async function install(root: string, source: string, options?: { local?: boolean; subpath?: string }): Promise<void> {
  const isRemote = !options?.local && /^https?:\/\//i.test(source);

  let name: string;
  let fetchedPath: string;
  let sourceType: "remote" | "local";
  let repoUrl: string | undefined;
  let ref: string | undefined;
  let commit: string | undefined;
  let sourceId: string;

  try {
    if (isRemote) {
      const fetchResult = await fetchRemote(root, source);
      name = fetchResult.name;
      repoUrl = fetchResult.repoUrl;
      ref = fetchResult.ref;
      commit = fetchResult.commit;
      sourceId = fetchResult.source_id;
      fetchedPath = path.join(getWarehousePath(root, "remote"), fetchResult.source_id);
      sourceType = "remote";
    } else {
      name = await fetchLocal(root, source);
      sourceId = `local-${name}`;
      fetchedPath = path.join(getWarehousePath(root, "local"), name);
      sourceType = "local";
    }
  } catch (err) {
    error(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let effectiveSubpath: string | undefined;

  if (isRemote && options?.subpath === undefined) {
    const candidates = discoverSkills(fetchedPath);

    if (candidates.length === 0) {
      error("No SKILL.md found in repository");
      try {
        fs.rmSync(fetchedPath, { recursive: true, force: true });
      } catch {
        warn(`Failed to clean up ${fetchedPath}`);
      }
      process.exit(1);
    } else if (candidates.length === 1) {
      const candidate = candidates[0]!;
      info(`Discovered 1 skill: ${candidate.name}${candidate.subpath ? ` at ${candidate.subpath}` : ""}`);
      effectiveSubpath = candidate.subpath;
    } else {
      if (!process.stdin.isTTY) {
        const lines = [
          "Multiple skills found in repository. Use --subpath to specify which one to install.",
          ...candidates.map((c) => `  ${c.name} (${c.subpath || "root"})`),
          `Rerun with: hk-skill install ${source} --subpath <subpath>`,
        ];
        error(lines.join("\n"));
        try {
          fs.rmSync(fetchedPath, { recursive: true, force: true });
        } catch {
          warn(`Failed to clean up ${fetchedPath}`);
        }
        process.exit(1);
      } else {
        const selectedSubpath = await promptSelectSkill(
          "Multiple skills found in repository. Select one to install:",
          candidates
        );
        if (selectedSubpath === null) {
          try {
            fs.rmSync(fetchedPath, { recursive: true, force: true });
          } catch {
            warn(`Failed to clean up ${fetchedPath}`);
          }
          process.exit(1);
        }
        effectiveSubpath = selectedSubpath;
      }
    }
  } else {
    effectiveSubpath = options?.subpath;
  }

  const adaptPath = effectiveSubpath !== undefined ? path.join(fetchedPath, effectiveSubpath) : fetchedPath;

  const vetResult = vet(adaptPath);
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
      ? adapt(adaptPath, root, sourceType, repoUrl, ref, commit)
      : adapt(adaptPath, root, sourceType);
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
    source_id: sourceId,
    ...(effectiveSubpath !== undefined && { subpath: effectiveSubpath }),
  };

  saveSkillsRegistry(root, registry);

  const sources = loadSourcesRegistry(root);
  if (sourceType === "remote" && repoUrl && ref) {
    sources[sourceId] = {
      type: "remote",
      repo: repoUrl,
      ref,
      commit,
      local_path: path.relative(root, fetchedPath),
    };
  } else if (sourceType === "local") {
    sources[sourceId] = {
      type: "local",
      local_path: path.relative(root, fetchedPath),
    };
  }
  saveSourcesRegistry(root, sources);

  success(`Installed skill: ${adaptResult.name}`);
}
