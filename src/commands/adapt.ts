import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { adapt } from "../core/adapter.js";
import { loadSkillsRegistry } from "../services/registry.js";
import { error, success, warn } from "../utils/logger.js";
import { getWarehousePath } from "../utils/paths.js";

export async function adaptCommand(root: string, name: string): Promise<void> {
  const registry = loadSkillsRegistry(root);
  const entry = registry[name];

  if (!entry || !entry.installed) {
    error(`Skill not installed: ${name}`);
    process.exit(1);
  }

  let sourcePath: string | undefined;
  let sourceType: "local" | "remote" | "adapted" | undefined;

  const localPath = path.join(getWarehousePath(root, "local"), name);
  const remotePath = path.join(getWarehousePath(root, "remote"), name);
  const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);

  const pathMap = {
    local: localPath,
    remote: remotePath,
    adapted: adaptedPath,
  };

  let orderedTypes: Array<"local" | "remote" | "adapted"> = ["local", "remote", "adapted"];

  const manifestPath = path.join(root, "manifests", `${name}.yaml`);
  if (existsSync(manifestPath)) {
    try {
      const manifest = parse(readFileSync(manifestPath, "utf-8"));
      const preferred = manifest?.source?.type;
      if (preferred === "local" || preferred === "remote" || preferred === "adapted") {
        orderedTypes = [preferred, ...orderedTypes.filter((t) => t !== preferred)];
      }
    } catch {
      warn(`Failed to parse manifest for ${name}, using default source order`);
    }
  }

  for (const type of orderedTypes) {
    if (existsSync(path.join(pathMap[type], "SKILL.md"))) {
      sourcePath = pathMap[type];
      sourceType = type;
      break;
    }
  }

  if (!sourcePath || !sourceType) {
    error(`Skill source not found: ${name}`);
    process.exit(1);
  }

  const result = adapt(sourcePath, root, sourceType);

  if (!result.success) {
    error(`Adapt failed for ${name}: ${result.errors.join(", ")}`);
    process.exit(1);
  }

  success(`Adapted skill: ${name}`);
}
