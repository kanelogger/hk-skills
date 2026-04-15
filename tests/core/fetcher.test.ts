import { describe, it, expect, spyOn } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as childProcess from "node:child_process";
import { fetchLocal, fetchRemote } from "../../src/core/fetcher";

describe("fetchLocal", () => {
  function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "fetcher-local-test-"));
  }

  it("copies a local directory into warehouse/local and returns the skill name", async () => {
    const root = makeTempDir();
    const localSkillDir = makeTempDir();
    fs.writeFileSync(path.join(localSkillDir, "SKILL.md"), "# Test Skill\n");

    const result = await fetchLocal(root, localSkillDir);
    expect(result).toBe(path.basename(localSkillDir));

    const copiedFilePath = path.join(
      root,
      "warehouse",
      "local",
      path.basename(localSkillDir),
      "SKILL.md"
    );
    expect(fs.existsSync(copiedFilePath)).toBe(true);
    expect(fs.readFileSync(copiedFilePath, "utf-8")).toBe("# Test Skill\n");

    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(localSkillDir, { recursive: true, force: true });
  });

  it("overwrites the target if it already exists", async () => {
    const root = makeTempDir();
    const localSkillDir = makeTempDir();
    fs.writeFileSync(path.join(localSkillDir, "SKILL.md"), "# Updated Skill\n");

    const targetDir = path.join(root, "warehouse", "local", path.basename(localSkillDir));
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "old.txt"), "old content");

    const result = await fetchLocal(root, localSkillDir);
    expect(result).toBe(path.basename(localSkillDir));

    expect(fs.existsSync(path.join(targetDir, "old.txt"))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, "SKILL.md"))).toBe(true);
    expect(fs.readFileSync(path.join(targetDir, "SKILL.md"), "utf-8")).toBe("# Updated Skill\n");

    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(localSkillDir, { recursive: true, force: true });
  });
});

describe("fetchRemote", () => {
  function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "fetcher-remote-test-"));
  }

  it("clones a remote repo into warehouse/remote and returns metadata", async () => {
    const root = makeTempDir();
    const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
      if (cmd.includes("rev-parse HEAD")) {
        return "abc123" as never;
      }
      if (cmd.includes("rev-parse --abbrev-ref HEAD")) {
        return "main" as never;
      }
      return "" as never;
    });

    const repoUrl = "https://github.com/user/skills/my-skill";
    const result = await fetchRemote(root, repoUrl);
    expect(result).toEqual({ name: "my-skill", repoUrl, ref: "main", commit: "abc123" });

    const targetPath = path.join(root, "warehouse", "remote", "my-skill");
    expect(execSyncSpy).toHaveBeenCalledWith(
      `git clone "${repoUrl}" "${targetPath}"`,
      { stdio: "ignore" }
    );
    expect(execSyncSpy).toHaveBeenCalledWith(
      `git -C "${targetPath}" rev-parse HEAD`,
      { encoding: "utf-8" }
    );

    execSyncSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("pulls instead of cloning when the target already exists and returns metadata", async () => {
    const root = makeTempDir();
    const targetPath = path.join(root, "warehouse", "remote", "existing-skill");
    fs.mkdirSync(targetPath, { recursive: true });

    const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
      if (cmd.includes("rev-parse HEAD")) {
        return "def456" as never;
      }
      if (cmd.includes("rev-parse --abbrev-ref HEAD")) {
        return "feature-branch" as never;
      }
      return "" as never;
    });

    const repoUrl = "https://github.com/user/skills/existing-skill";
    const result = await fetchRemote(root, repoUrl);
    expect(result).toEqual({ name: "existing-skill", repoUrl, ref: "feature-branch", commit: "def456" });

    expect(execSyncSpy).toHaveBeenCalledWith(
      `git -C "${targetPath}" pull`,
      { stdio: "ignore" }
    );

    execSyncSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
