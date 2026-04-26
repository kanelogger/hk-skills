import { describe, it, expect, spyOn } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as childProcess from "node:child_process";
import { fetchLocal, fetchRemote, generateSourceId } from "../../src/core/fetcher";

describe("generateSourceId", () => {
  it("strips protocol, .git suffix, appends @ref, and replaces slashes", () => {
    const result = generateSourceId("https://github.com/JimLiu/baoyu-skills.git", "main");
    expect(result).toBe("github.com_JimLiu_baoyu-skills@main");
  });

  it("is deterministic for the same url and ref", () => {
    const url = "https://github.com/user/skills/my-skill";
    const ref = "main";
    expect(generateSourceId(url, ref)).toBe(generateSourceId(url, ref));
  });

  it("produces different ids for different refs", () => {
    const url = "https://github.com/user/skills/my-skill";
    expect(generateSourceId(url, "main")).not.toBe(generateSourceId(url, "dev"));
  });

  it("handles urls without .git suffix", () => {
    const result = generateSourceId("https://gitlab.com/org/project", "v1.0");
    expect(result).toBe("gitlab.com_org_project@v1.0");
  });
});

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

  it("clones a remote repo into warehouse/remote/<source_id> and returns metadata", async () => {
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
    const sourceId = generateSourceId(repoUrl, "main");
    const result = await fetchRemote(root, repoUrl);
    expect(result).toEqual({ source_id: sourceId, name: "my-skill", repoUrl, ref: "main", commit: "abc123" });

    const targetPath = path.join(root, "warehouse", "remote", sourceId);
    expect(execSyncSpy).toHaveBeenCalledWith(
      `git clone --branch "main" "${repoUrl}" "${targetPath}"`,
      { stdio: "ignore" }
    );
    expect(execSyncSpy).toHaveBeenCalledWith(
      `git -C "${targetPath}" rev-parse HEAD`,
      { encoding: "utf-8" }
    );

    execSyncSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("uses the provided ref and includes it in source_id", async () => {
    const root = makeTempDir();
    const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
      if (cmd.includes("rev-parse HEAD")) {
        return "def789" as never;
      }
      if (cmd.includes("rev-parse --abbrev-ref HEAD")) {
        return "feature-x" as never;
      }
      return "" as never;
    });

    const repoUrl = "https://github.com/user/skills/my-skill";
    const ref = "feature-x";
    const sourceId = generateSourceId(repoUrl, ref);
    const result = await fetchRemote(root, repoUrl, ref);
    expect(result).toEqual({ source_id: sourceId, name: "my-skill", repoUrl, ref: "feature-x", commit: "def789" });

    const targetPath = path.join(root, "warehouse", "remote", sourceId);
    expect(execSyncSpy).toHaveBeenCalledWith(
      `git clone --branch "${ref}" "${repoUrl}" "${targetPath}"`,
      { stdio: "ignore" }
    );

    execSyncSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("pulls and checks out ref when the target already exists", async () => {
    const root = makeTempDir();
    const repoUrl = "https://github.com/user/skills/existing-skill";
    const ref = "main";
    const sourceId = generateSourceId(repoUrl, ref);
    const targetPath = path.join(root, "warehouse", "remote", sourceId);
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

    const result = await fetchRemote(root, repoUrl, ref);
    expect(result).toEqual({ source_id: sourceId, name: "existing-skill", repoUrl, ref: "feature-branch", commit: "def456" });

    expect(execSyncSpy).toHaveBeenCalledWith(
      `git -C "${targetPath}" pull origin "${ref}"`,
      { stdio: "ignore" }
    );

    execSyncSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("falls back to default branch when main does not exist", async () => {
    const root = makeTempDir();
    const repoUrl = "https://github.com/user/skills/master-only";
    const sourceId = generateSourceId(repoUrl, "main");
    const targetPath = path.join(root, "warehouse", "remote", sourceId);

    let callCount = 0;
    const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
      callCount++;
      if (cmd.includes('git clone --branch "main"')) {
        throw new Error("Remote branch main not found");
      }
      if (cmd.includes("rev-parse HEAD")) {
        return "master123" as never;
      }
      if (cmd.includes("rev-parse --abbrev-ref HEAD")) {
        return "master" as never;
      }
      return "" as never;
    });

    const result = await fetchRemote(root, repoUrl);
    expect(result).toEqual({ source_id: sourceId, name: "master-only", repoUrl, ref: "master", commit: "master123" });
    expect(execSyncSpy).toHaveBeenCalledWith(
      `git clone "${repoUrl}" "${targetPath}"`,
      { stdio: "ignore" }
    );

    execSyncSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("throws when a non-main ref does not exist", async () => {
    const root = makeTempDir();
    const repoUrl = "https://github.com/user/skills/my-skill";
    const ref = "nonexistent";

    const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
      if (cmd.includes(`git clone --branch "${ref}"`)) {
        throw new Error("Remote branch nonexistent not found");
      }
      return "" as never;
    });

    expect(fetchRemote(root, repoUrl, ref)).rejects.toThrow('Failed to clone');

    execSyncSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
