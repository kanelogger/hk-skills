import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { resolve, basename } from "node:path";
import { execSync } from "node:child_process";
import { getWarehousePath } from "../utils/paths";
import { warn } from "../utils/logger.js";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export interface FetchRemoteResult {
  source_id: string;
  name: string;
  repoUrl: string;
  ref: string;
  commit: string;
}

export function generateSourceId(repoUrl: string, ref: string): string {
  let clean = repoUrl.trim();
  clean = clean.replace(/^\w+:\/\//, "");
  clean = clean.replace(/\.git$/, "");
  clean = `${clean}@${ref}`;
  clean = clean.replace(/\//g, "_");
  return clean;
}

export async function fetchRemote(
  root: string,
  repoUrl: string,
  ref: string = "main"
): Promise<FetchRemoteResult> {
  const url = new URL(repoUrl);
  const name = basename(url.pathname);
  if (!name) {
    throw new Error("Could not derive skill name from repo URL");
  }

  const source_id = generateSourceId(repoUrl, ref);
  const warehouseDir = getWarehousePath(root, "remote");
  ensureDir(warehouseDir);

  const targetPath = resolve(warehouseDir, source_id);

  if (existsSync(targetPath)) {
    try {
      execSync(`git -C "${targetPath}" pull origin "${ref}"`, { stdio: "ignore" });
    } catch {
      if (ref === "main") {
        execSync(`git -C "${targetPath}" pull`, { stdio: "ignore" });
      } else {
        throw new Error(`Failed to pull ${repoUrl} at branch "${ref}"`);
      }
    }
  } else {
    try {
      execSync(`git clone --branch "${ref}" "${repoUrl}" "${targetPath}"`, { stdio: "ignore" });
    } catch {
      if (ref === "main") {
        execSync(`git clone "${repoUrl}" "${targetPath}"`, { stdio: "ignore" });
      } else {
        throw new Error(`Failed to clone ${repoUrl} at branch "${ref}"`);
      }
    }
  }

  const commit = execSync(`git -C "${targetPath}" rev-parse HEAD`, {
    encoding: "utf-8",
  }).trim();

  let detectedRef = ref;
  try {
    const branch = execSync(`git -C "${targetPath}" rev-parse --abbrev-ref HEAD`, {
      encoding: "utf-8",
    }).trim();
    if (branch && branch !== "HEAD") {
      detectedRef = branch;
    }
  } catch (err) {
    warn(`Failed to determine branch for ${targetPath}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { source_id, name, repoUrl, ref: detectedRef, commit };
}

export async function fetchLocal(
  root: string,
  localPath: string
): Promise<string> {
  const name = basename(localPath);
  if (!name) {
    throw new Error("Could not derive skill name from local path");
  }

  const warehouseDir = getWarehousePath(root, "local");
  ensureDir(warehouseDir);

  const targetPath = resolve(warehouseDir, name);

  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }

  cpSync(localPath, targetPath, { recursive: true });

  return name;
}
