import fs from "node:fs";
import path from "node:path";
import { parseSkillMd } from "../utils/parse-skill-md";

export interface DiscoveredSkill {
  subpath: string;
  name: string;
}

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "test",
  "tests",
  ".github",
]);

const MAX_DEPTH = 5;
const MAX_FILE_SIZE = 1 * 1024 * 1024;

function isBinary(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);
    return buffer.subarray(0, bytesRead).includes(0);
  } catch {
    return true;
  }
}

function normalizeSubpath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function walk(
  dir: string,
  repoPath: string,
  results: DiscoveredSkill[],
  depth: number
): void {
  if (depth > MAX_DEPTH) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const hasSkillMd = entries.some(
    (entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name === "SKILL.md"
  );

  if (hasSkillMd) {
    const skillMdPath = path.join(dir, "SKILL.md");

    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(skillMdPath);
    } catch {
      return;
    }

    if (
      !stat.isSymbolicLink() &&
      stat.isFile() &&
      stat.size <= MAX_FILE_SIZE &&
      !isBinary(skillMdPath)
    ) {
      try {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const parsed = parseSkillMd(content);
        if (
          parsed.frontmatter !== null &&
          typeof parsed.frontmatter.name === "string" &&
          parsed.frontmatter.name.length > 0
        ) {
          const relativeDir = path.relative(repoPath, dir);
          const subpath = normalizeSubpath(relativeDir);
          results.push({ subpath, name: parsed.frontmatter.name });
        }
      } catch {
      }
    }

  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), repoPath, results, depth + 1);
    }
  }
}

export function discoverSkills(repoPath: string): DiscoveredSkill[] {
  const results: DiscoveredSkill[] = [];
  walk(repoPath, repoPath, results, 0);
  results.sort((a, b) => a.subpath.localeCompare(b.subpath));
  return results;
}
