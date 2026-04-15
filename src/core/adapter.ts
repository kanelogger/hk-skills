import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { stringify } from "yaml";
import { parseSkillMd } from "../utils/parse-skill-md.js";
import { getManifestPath, getWarehousePath } from "../utils/paths.js";
import { detectAgent, detectOs } from "../utils/env.js";
import { warn } from "../utils/logger.js";

const require = createRequire(import.meta.url);

export interface AdaptResult {
  success: boolean;
  name: string;
  errors: string[];
}

export function adapt(
  inputPath: string,
  root: string,
  sourceType: "local" | "remote" | "adapted",
  repo?: string,
  ref?: string,
  commit?: string
): AdaptResult {
  const errors: string[] = [];

  const skillMdPath = resolve(inputPath, "SKILL.md");
  let content: string;
  try {
    content = readFileSync(skillMdPath, "utf-8");
  } catch {
    errors.push(`Failed to read SKILL.md at ${skillMdPath}`);
    return {
      success: false,
      name: basename(inputPath),
      errors,
    };
  }

  const parsed = parseSkillMd(content);
  const frontmatter = parsed.frontmatter ?? {};

  const name =
    typeof frontmatter.name === "string" && frontmatter.name.length > 0
      ? frontmatter.name
      : basename(inputPath);

  const displayName =
    typeof frontmatter.display_name === "string" &&
    frontmatter.display_name.length > 0
      ? frontmatter.display_name
      : name;

  const source: Record<string, unknown> = { type: sourceType };
  if (sourceType === "remote") {
    if (typeof repo === "string" && repo.length > 0) {
      source.repo = repo;
    } else if (typeof frontmatter.repo === "string" && frontmatter.repo.length > 0) {
      source.repo = frontmatter.repo;
    }
    if (typeof ref === "string" && ref.length > 0) {
      source.ref = ref;
    }
    if (typeof commit === "string" && commit.length > 0) {
      source.commit = commit;
    }
  }

  let rewrittenContent: string | undefined;
  let derivedAgent: string | undefined;
  let detectedAgent: string | undefined;

  if (name !== "adapter") {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const enginePath = resolve(__dirname, "../../warehouse/local/adapter/engine.ts");
    if (existsSync(enginePath)) {
      try {
        const mod = require(enginePath);
        detectedAgent = detectAgent();
        const os = detectOs();
        derivedAgent = mod.deriveAgent(content);
        rewrittenContent = mod.rewriteSkillMd(content, { agent: detectedAgent, os, sourceType });
      } catch (e) {
        warn(
          `Adapter engine unavailable, falling back to copy-only: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    } else {
      warn(`Adapter engine not found at ${enginePath}, falling back to copy-only`);
    }
  }

  const manifest: Record<string, unknown> = {
    name,
    display_name: displayName,
    source,
    status: {
      stage: "adapted",
    },
    entry: {
      file: "SKILL.md",
    },
  };

  if (frontmatter.skip_vet === true) {
    manifest.skip_vet = true;
  }

  if (rewrittenContent !== undefined && detectedAgent !== undefined) {
    manifest.adapter = {
      target: detectedAgent,
      adapted_from: derivedAgent ?? null,
    };
  }

  const manifestPath = getManifestPath(root, name);
  try {
    mkdirSync(resolve(manifestPath, ".."), { recursive: true });
    writeFileSync(manifestPath, stringify(manifest), "utf-8");
  } catch (err) {
    errors.push(
      `Failed to write manifest: ${err instanceof Error ? err.message : String(err)}`
    );
    return { success: false, name, errors };
  }

  const destPath = resolve(getWarehousePath(root, "adapted"), name);
  try {
    mkdirSync(resolve(destPath, ".."), { recursive: true });
    cpSync(inputPath, destPath, { recursive: true });
    if (rewrittenContent !== undefined) {
      writeFileSync(resolve(destPath, "SKILL.md"), rewrittenContent, "utf-8");
    }
  } catch (err) {
    errors.push(
      `Failed to copy skill directory: ${err instanceof Error ? err.message : String(err)}`
    );
    return { success: false, name, errors };
  }

  return { success: true, name, errors };
}
