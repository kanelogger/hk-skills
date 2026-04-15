import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse } from "yaml";
import { init } from "../../src/commands/init.js";
import { install } from "../../src/commands/install.js";
import { update } from "../../src/commands/update.js";
import { enableSkill } from "../../src/core/activator.js";
import { loadSkillsRegistry } from "../../src/services/registry.js";
import * as fetcher from "../../src/core/fetcher.js";

describe("update-lifecycle", () => {
  let tempDir: string;
  let fetchRemoteSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "hk-skills-update-lifecycle-test-")
    );
  });

  afterEach(() => {
    if (fetchRemoteSpy) fetchRemoteSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("installs, enables, and updates a remote skill", async () => {
    init(tempDir);

    let commitCounter = 0;
    fetchRemoteSpy = spyOn(fetcher, "fetchRemote").mockImplementation(async (root, repoUrl) => {
      const name = "remote-skill";
      const targetPath = path.join(root, "warehouse", "remote", name);
      fs.mkdirSync(targetPath, { recursive: true });
      const commit = commitCounter === 0 ? "abc123" : "def456";
      commitCounter++;
      fs.writeFileSync(
        path.join(targetPath, "SKILL.md"),
        `---\nname: ${name}\n---\n\n# ${name} commit ${commit}\n`,
        "utf-8"
      );
      return { name, repoUrl, ref: "main", commit };
    });

    await install(tempDir, "https://github.com/user/remote-skill");

    const registryAfterInstall = loadSkillsRegistry(tempDir);
    expect(registryAfterInstall["remote-skill"]).toBeDefined();
    expect(registryAfterInstall["remote-skill"]!.installed).toBe(true);

    enableSkill(tempDir, "remote-skill", "global");

    const linkPath = path.join(tempDir, "runtime", "global", "remote-skill");
    expect(fs.existsSync(linkPath)).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);

    const manifestPathBefore = path.join(tempDir, "manifests", "remote-skill.yaml");
    const manifestBefore = parse(fs.readFileSync(manifestPathBefore, "utf-8")) as Record<string, unknown>;
    expect((manifestBefore.source as Record<string, string>).commit).toBe("abc123");

    await update(tempDir, "remote-skill", {});

    const manifestPathAfter = path.join(tempDir, "manifests", "remote-skill.yaml");
    const manifestAfter = parse(fs.readFileSync(manifestPathAfter, "utf-8")) as Record<string, unknown>;
    expect((manifestAfter.source as Record<string, string>).commit).toBe("def456");

    const registryAfterUpdate = loadSkillsRegistry(tempDir);
    expect(registryAfterUpdate["remote-skill"]!.updated_at).not.toBe(
      registryAfterInstall["remote-skill"]!.updated_at
    );

    expect(fs.existsSync(linkPath)).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
  });

  it("updates multiple remote skills with --all", async () => {
    init(tempDir);

    const commits = new Map<string, number>();
    fetchRemoteSpy = spyOn(fetcher, "fetchRemote").mockImplementation(async (root, repoUrl) => {
      const name = repoUrl.endsWith("skill-a") ? "skill-a" : "skill-b";
      const targetPath = path.join(root, "warehouse", "remote", name);
      fs.mkdirSync(targetPath, { recursive: true });
      const count = commits.get(name) ?? 0;
      const commit = count === 0 ? "abc123" : "def456";
      commits.set(name, count + 1);
      fs.writeFileSync(
        path.join(targetPath, "SKILL.md"),
        `---\nname: ${name}\n---\n\n# ${name}\n`,
        "utf-8"
      );
      return { name, repoUrl, ref: "main", commit };
    });

    await install(tempDir, "https://github.com/user/skill-a");
    await install(tempDir, "https://github.com/user/skill-b");

    enableSkill(tempDir, "skill-a", "global");
    enableSkill(tempDir, "skill-b", "global");

    await update(tempDir, undefined, { all: true });

    for (const name of ["skill-a", "skill-b"]) {
      const manifestPath = path.join(tempDir, "manifests", `${name}.yaml`);
      const manifest = parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
      expect((manifest.source as Record<string, string>).commit).toBe("def456");

      const linkPath = path.join(tempDir, "runtime", "global", name);
      expect(fs.existsSync(linkPath)).toBe(true);
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    }
  });
});
