import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { resolveSourcePath } from "../core/activator.js";
import {
  loadSkillsRegistry,
  saveSkillsRegistry,
  loadSourcesRegistry,
  saveSourcesRegistry,
  loadProjectsRegistry,
  saveProjectsRegistry,
} from "../services/registry.js";
import { getManifestPath, getWarehousePath, getRuntimePath, getProjectAgentsSkillsPath, canonicalizeProjectId } from "../utils/paths.js";
import { info, warn, error, success } from "../utils/logger.js";

function resolveProjectPathFromCanonicalId(canonicalId: string): string {
  try {
    const decoded = Buffer.from(canonicalId, "base64url").toString("utf-8");
    if (path.isAbsolute(decoded)) {
      return decoded;
    }
  } catch {}
  return canonicalId;
}

export function safeDisableAll(root: string, name: string): void {
  const registry = loadSkillsRegistry(root);
  const entry = registry[name];
  if (!entry) return;

  if (entry.enabled_global) {
    const linkPath = path.join(root, "runtime", "global", name);
    try {
      const lstat = fs.lstatSync(linkPath);
      if (lstat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      }
    } catch (e) {
      warn(
        `Warning: global symlink for ${name} not found or broken: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
    entry.enabled_global = false;
  }

  for (const project of [...entry.enabled_projects]) {
    const linkPath = path.join(getRuntimePath(root, { project }), name);
    try {
      const lstat = fs.lstatSync(linkPath);
      if (lstat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      }
    } catch (e) {
      warn(
        `Warning: project symlink for ${name} in ${project} not found or broken: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }

    const agentsLinkPath = path.join(getProjectAgentsSkillsPath(resolveProjectPathFromCanonicalId(project)), name);
    try {
      const lstat = fs.lstatSync(agentsLinkPath);
      if (lstat.isSymbolicLink()) {
        fs.unlinkSync(agentsLinkPath);
      }
    } catch (e) {
      warn(
        `Warning: agents skills symlink for ${name} in ${project} not found or broken: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }
  entry.enabled_projects = [];

  saveSkillsRegistry(root, registry);
}

export function promptConfirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} (Y/n) `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "" || trimmed === "y") {
        resolve(true);
      } else if (trimmed === "n") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export async function removeSkill(
  root: string,
  name: string,
  options: { promptConfirm?: (msg: string) => Promise<boolean>; yes?: boolean }
): Promise<void> {
  const registry = loadSkillsRegistry(root);
  const entry = registry[name];

  if (!entry || entry.installed !== true) {
    error(`Skill "${name}" is not installed`);
    process.exit(1);
  }

  const confirmFn = options.promptConfirm ?? promptConfirm;

  if (!options.yes) {
    const confirmed = await confirmFn(`Remove skill "${name}"?`);
    if (!confirmed) {
      return;
    }
  }

  safeDisableAll(root, name);

  let sourcePath: string | undefined;
  try {
    sourcePath = resolveSourcePath(root, name);
  } catch {
    warn(`Warehouse directory for skill "${name}" not found`);
  }

  if (sourcePath && fs.existsSync(sourcePath)) {
    fs.rmSync(sourcePath, { recursive: true, force: true });
  } else if (!sourcePath) {
    warn(`Warehouse directory for skill "${name}" not found`);
  }

  const manifestPath = getManifestPath(root, name);
  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
  }

  const sourceId = entry.source_id;

  delete registry[name];
  saveSkillsRegistry(root, registry);

  const sources = loadSourcesRegistry(root);
  const otherSkillUsesSource = Object.values(registry).some(
    (skill) => skill.source_id === sourceId
  );
  if (!otherSkillUsesSource) {
    delete sources[sourceId];
    const remotePath = path.join(getWarehousePath(root, "remote"), sourceId);
    if (fs.existsSync(remotePath)) {
      fs.rmSync(remotePath, { recursive: true, force: true });
    }
  }
  saveSourcesRegistry(root, sources);

  const projects = loadProjectsRegistry(root);
  for (const key in projects) {
    const project = projects[key];
    if (project && project.skills.includes(name)) {
      project.skills = project.skills.filter((s) => s !== name);
    }
  }
  saveProjectsRegistry(root, projects);

  success(`Removed skill: ${name}`);
}

export async function remove(
  root: string,
  name: string | undefined,
  options: {
    unused?: boolean;
    yes?: boolean;
    promptConfirm?: (msg: string) => Promise<boolean>;
  }
): Promise<void> {
  if (name !== undefined && options.unused) {
    error("Cannot specify both a skill name and --unused");
    process.exit(1);
  }

  if (options.unused) {
    const registry = loadSkillsRegistry(root);
    const unusedSkills = Object.entries(registry)
      .filter(([_, entry]) => entry.enabled_global === false && entry.enabled_projects.length === 0)
      .map(([skillName]) => skillName);

    if (unusedSkills.length === 0) {
      info("No unused skills to remove.");
      return;
    }

    const confirmFn = options.promptConfirm ?? promptConfirm;

    if (!options.yes) {
      const confirmed = await confirmFn(
        `Remove unused skills: ${unusedSkills.join(", ")}?`
      );
      if (!confirmed) {
        return;
      }
    }

    for (const skillName of unusedSkills) {
      await removeSkill(root, skillName, {
        promptConfirm: options.promptConfirm,
        yes: options.yes,
      });
    }
    return;
  }

  if (name === undefined) {
    error("Must specify either a skill name or --unused");
    process.exit(1);
  }

  await removeSkill(root, name, {
    promptConfirm: options.promptConfirm,
    yes: options.yes,
  });
}
