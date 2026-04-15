import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { parseSkillMd } from "../utils/parse-skill-md";

const require = createRequire(import.meta.url);

export interface VetResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

interface Rule {
  id: string;
  description: string;
  pattern: RegExp;
  severity: "warning" | "error";
  fileFilter?: string[];
}

function deriveKeywords(rule: Rule): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const addKeyword = (kw: string) => {
    const lower = kw.toLowerCase();
    if (!seen.has(lower) && kw.length >= 2) {
      seen.add(lower);
      result.push(kw);
    }
  };

  for (const part of rule.id.split("-")) {
    addKeyword(part);
  }

  const descMatch = rule.description.match(/\b[a-zA-Z_][a-zA-Z0-9_\.]*\b/g);
  if (descMatch) {
    for (const word of descMatch) {
      addKeyword(word);
    }
  }

  return result;
}

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

function isStopwordMatch(text: string, stopwords: string[]): boolean {
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 0);

  const singleTokenStopwords = new Set<string>();
  const multiTokenStopwords: string[][] = [];

  for (const sw of stopwords) {
    const swLower = sw.toLowerCase();
    const swTokens = swLower.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
    if (swTokens.length === 1) {
      singleTokenStopwords.add(swTokens[0]!);
    } else {
      multiTokenStopwords.push(swTokens);
    }
  }

  if (tokens.length > 0 && tokens.every((t) => singleTokenStopwords.has(t))) {
    return true;
  }

  for (const swTokens of multiTokenStopwords) {
    let tokenIdx = 0;
    let swIdx = 0;
    while (tokenIdx < tokens.length && swIdx < swTokens.length) {
      if (tokens[tokenIdx] === swTokens[swIdx]) {
        swIdx++;
      }
      tokenIdx++;
    }
    if (swIdx === swTokens.length) {
      return true;
    }
  }

  return false;
}

function walkFiles(
  dir: string,
  skillPath: string,
  callback: (filePath: string) => void,
  visited: Set<string> = new Set(),
  depth = 0
): void {
  if (depth > 20) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.name === "node_modules" || entry.name === ".git") continue;

    if (entry.isSymbolicLink()) {
      let realPath: string;
      try {
        realPath = fs.realpathSync(fullPath);
      } catch {
        continue;
      }

      if (visited.has(realPath)) continue;

      const relativeToSkill = path.relative(skillPath, realPath);
      if (relativeToSkill.startsWith("..") || path.isAbsolute(relativeToSkill)) {
        continue;
      }

      visited.add(realPath);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walkFiles(realPath, skillPath, callback, visited, depth + 1);
      } else if (stat.isFile()) {
        if (stat.size > 1024 * 1024) continue;
        if (isBinary(fullPath)) continue;
        callback(fullPath);
      }
      continue;
    }

    if (entry.isDirectory()) {
      walkFiles(fullPath, skillPath, callback, visited, depth + 1);
    } else if (entry.isFile()) {
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.size > 1024 * 1024) continue;
      if (isBinary(fullPath)) continue;
      callback(fullPath);
    }
  }
}

export function vet(skillPath: string): VetResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(skillPath)) {
    errors.push(`Path does not exist: ${skillPath}`);
    return { passed: false, warnings, errors };
  }

  const stat = fs.statSync(skillPath);
  if (!stat.isDirectory()) {
    errors.push(`Path is not a directory: ${skillPath}`);
    return { passed: false, warnings, errors };
  }

  const skillMdPath = path.join(skillPath, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    errors.push(`SKILL.md is missing in directory: ${skillPath}`);
    return { passed: false, warnings, errors };
  }

  const content = fs.readFileSync(skillMdPath, "utf-8");
  const parsed = parseSkillMd(content);

  if (parsed.frontmatter === null) {
    errors.push(`SKILL.md has unparseable or missing YAML frontmatter`);
    return { passed: false, warnings, errors };
  }

  const name = parsed.frontmatter.name;
  if (typeof name !== "string" || name.length === 0) {
    errors.push(`SKILL.md frontmatter must have a non-empty 'name' field`);
    return { passed: false, warnings, errors };
  }

  if (parsed.frontmatter.skip_vet === true) {
    return { passed: true, warnings, errors };
  }

  let rules: Rule[] = [];
  let stopwords: string[] = [];

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const rulesPath = path.resolve(
      __dirname,
      "../../warehouse/local/advanced-vetter/rules.ts"
    );
    if (fs.existsSync(rulesPath)) {
      const mod = require(rulesPath);
      rules = mod.rules || [];
      stopwords = mod.stopwords || [];
    }
  } catch (e) {
    warnings.push(
      `Failed to load advanced vetter rules: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const resolvedSkillPath = path.resolve(skillPath);

  if (rules.length > 0) {
    walkFiles(resolvedSkillPath, resolvedSkillPath, (filePath) => {
      let fileContent: string;
      try {
        fileContent = fs.readFileSync(filePath, "utf-8");
      } catch {
        return;
      }

      const relativePath = path.relative(resolvedSkillPath, filePath);

      for (const rule of rules) {
        if (rule.fileFilter && rule.fileFilter.length > 0) {
          const ext = path.extname(filePath);
          const basename = path.basename(filePath);
          if (
            !rule.fileFilter.some(
              (filter) => ext === filter || basename === filter
            )
          ) {
            continue;
          }
        }

        const keywords = deriveKeywords(rule);
        const lines = fileContent.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const lineLower = line.toLowerCase();

          if (!keywords.some((kw) => lineLower.includes(kw.toLowerCase()))) {
            continue;
          }

          const match = rule.pattern.exec(line);
          if (match) {
            const matchText = match[0];
            const quotedValue = matchText.match(/['"]([^'"]*)['"]/)?.[1];
            const textToCheck =
              quotedValue !== undefined ? quotedValue : matchText;

            if (isStopwordMatch(textToCheck, stopwords)) {
              continue;
            }

            const message = `${rule.id}: ${rule.description} in ${relativePath}:${i + 1}`;
            if (rule.severity === "error") {
              errors.push(message);
            } else {
              warnings.push(message);
            }
          }
        }
      }
    });
  }

  return { passed: errors.length === 0, warnings, errors };
}
