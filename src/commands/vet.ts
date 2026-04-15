import fs from "node:fs";
import path from "node:path";
import { vet as vetSkill } from "../core/vetter.js";
import { error, warn, success } from "../utils/logger.js";
import { getWarehousePath } from "../utils/paths.js";

export function vet(root: string, name: string): void {
  let skillPath: string | undefined;

  const adaptedPath = path.join(getWarehousePath(root, "adapted"), name);
  const localPath = path.join(getWarehousePath(root, "local"), name);
  const remotePath = path.join(getWarehousePath(root, "remote"), name);

  for (const p of [adaptedPath, localPath, remotePath]) {
    if (fs.existsSync(path.join(p, "SKILL.md"))) {
      skillPath = p;
      break;
    }
  }

  if (!skillPath) {
    error(`Skill not found: ${name}`);
    process.exit(1);
  }

  const result = vetSkill(skillPath);

  for (const w of result.warnings) {
    warn(w);
  }

  if (!result.passed) {
    for (const err of result.errors) {
      error(err);
    }
    process.exit(1);
  }

  success(`Vet passed for ${name}`);
}
