import { existsSync } from "node:fs";
import { resolve, dirname, isAbsolute, basename } from "node:path";

export function getRootPath(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(resolve(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Could not find repo root (no package.json found)");
}

export function getWarehousePath(
  root: string,
  type: "remote" | "adapted" | "local"
): string {
  return resolve(root, "warehouse", type);
}

export function getManifestPath(root: string, name: string): string {
  return resolve(root, "manifests", `${name}.yaml`);
}

function isSimpleProjectId(raw: string): boolean {
  return !raw.includes("/") && !raw.includes("\\") && !raw.startsWith(".");
}

export function canonicalizeProjectId(rawProjectPath: string): string {
  if (isSimpleProjectId(rawProjectPath)) {
    return rawProjectPath;
  }
  const absolute = resolve(rawProjectPath);
  return Buffer.from(absolute, "utf-8").toString("base64url");
}

export function getRuntimePath(
  root: string,
  scope: "global" | { project: string }
): string {
  if (scope === "global") {
    return resolve(root, "runtime", "global");
  }
  return resolve(root, "runtime", "projects", canonicalizeProjectId(scope.project));
}

export function getProjectAgentsPath(projectPath: string): string {
  return resolve(projectPath, ".agents");
}

export function getProjectAgentsSkillsPath(projectPath: string): string {
  return resolve(projectPath, ".agents", "skills");
}

export function resolveProjectPathFromCanonicalId(canonicalId: string): string {
  if (isSimpleProjectId(canonicalId)) {
    return canonicalId;
  }
  try {
    const decoded = Buffer.from(canonicalId, "base64url").toString("utf-8");
    if (isAbsolute(decoded) && existsSync(resolve(decoded, ".agents", "skills"))) {
      return decoded;
    }
  } catch {}
  return canonicalId;
}
