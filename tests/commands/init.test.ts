import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { parse } from "yaml";
import { init } from "../../src/commands/init.js";

describe("init", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "hk-skills-init-test-"));

    const customSkills = [
      "prompt-optimizer",
      "skill-installer",
      "subtext-article",
      "webapp-build",
    ];
    for (const name of customSkills) {
      const dir = resolve(tempDir, "custom", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, "SKILL.md"),
        `---\nname: ${name}\n---\n\n# ${name}\n`,
        "utf-8"
      );
    }

    const digitalMeDir = resolve(tempDir, "custom", "digital-me");
    mkdirSync(digitalMeDir, { recursive: true });
    writeFileSync(
      resolve(digitalMeDir, "readme.md"),
      "# digital-me\n",
      "utf-8"
    );

    const skillsDirSkills = [
      "autoresearch",
      "economic-analysis",
      "financial-analysis",
      "merge-drafts",
      "vetter",
    ];
    for (const name of skillsDirSkills) {
      const dir = resolve(tempDir, "skills", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, "SKILL.md"),
        `---\nname: ${name}\n---\n\n# ${name}\n`,
        "utf-8"
      );
    }

    const frontendDir = resolve(tempDir, "skills", "frontend");
    mkdirSync(frontendDir, { recursive: true });
    writeFileSync(
      resolve(frontendDir, "SKILL.md"),
      `---\nname: frontend-skill\n---\n\n# frontend\n`,
      "utf-8"
    );

    const insightsDir = resolve(tempDir, "skills", "Insights");
    mkdirSync(insightsDir, { recursive: true });
    writeFileSync(
      resolve(insightsDir, "SKILL.md"),
      `---\nname: insights\n---\n\n# Insights\n`,
      "utf-8"
    );

    const remoteDir = resolve(tempDir, "remote");
    mkdirSync(remoteDir, { recursive: true });
    writeFileSync(
      resolve(remoteDir, "menu.md"),
      `# Remote Skill Sources\n\n| Skill | Repo | Ref | Upstream Path | Staged Path | URL |\n| --- | --- | --- | --- | --- | --- |\n`,
      "utf-8"
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates directory skeleton and migrates legacy skills", () => {
    init(tempDir);

    const dirs = [
      "registry",
      "manifests",
      "warehouse/remote",
      "warehouse/adapted",
      "warehouse/local",
      "runtime/global",
      "runtime/projects",
      "logs",
      "patches",
      "docs",
    ];
    for (const dir of dirs) {
      expect(existsSync(resolve(tempDir, dir))).toBe(true);
    }

    const skillsPath = resolve(tempDir, "registry", "skills.json");
    expect(existsSync(skillsPath)).toBe(true);
    const skillsRegistry = JSON.parse(readFileSync(skillsPath, "utf-8"));

    const expectedSkills = [
      "prompt-optimizer",
      "skill-installer",
      "subtext-article",
      "webapp-build",
      "digital-me",
      "autoresearch",
      "economic-analysis",
      "financial-analysis",
      "frontend-skill",
      "merge-drafts",
      "vetter",
      "insights",
    ];

    expect(Object.keys(skillsRegistry).sort()).toEqual(expectedSkills.sort());

    for (const name of expectedSkills) {
      expect(skillsRegistry[name]).toEqual({
        manifest: `manifests/${name}.yaml`,
        installed: true,
        enabled_global: false,
        enabled_projects: [],
        updated_at: expect.any(String),
      });
    }

    for (const name of expectedSkills) {
      expect(existsSync(resolve(tempDir, "manifests", `${name}.yaml`))).toBe(
        true
      );
    }

    for (const name of [
      "prompt-optimizer",
      "skill-installer",
      "subtext-article",
      "webapp-build",
    ]) {
      expect(
        existsSync(resolve(tempDir, "warehouse", "adapted", name, "SKILL.md"))
      ).toBe(true);
    }

    for (const name of [
      "autoresearch",
      "economic-analysis",
      "financial-analysis",
      "frontend-skill",
      "merge-drafts",
      "vetter",
      "insights",
    ]) {
      expect(
        existsSync(resolve(tempDir, "warehouse", "adapted", name, "SKILL.md"))
      ).toBe(true);
    }

    expect(
      existsSync(resolve(tempDir, "warehouse", "local", "digital-me", "readme.md"))
    ).toBe(true);

    const digitalMeManifest = parse(
      readFileSync(resolve(tempDir, "manifests", "digital-me.yaml"), "utf-8")
    );
    expect(digitalMeManifest).toEqual({
      name: "digital-me",
      display_name: "digital-me",
      source: { type: "local" },
      status: { stage: "adapted" },
      entry: { file: "readme.md" },
    });

    const sourcesPath = resolve(tempDir, "registry", "sources.json");
    expect(existsSync(sourcesPath)).toBe(true);
    const sourcesRegistry = JSON.parse(readFileSync(sourcesPath, "utf-8"));
    expect(sourcesRegistry).toEqual({});
  });

  it("is idempotent", () => {
    init(tempDir);
    init(tempDir);

    const skillsPath = resolve(tempDir, "registry", "skills.json");
    const skillsRegistry = JSON.parse(readFileSync(skillsPath, "utf-8"));

    const expectedSkills = [
      "prompt-optimizer",
      "skill-installer",
      "subtext-article",
      "webapp-build",
      "digital-me",
      "autoresearch",
      "economic-analysis",
      "financial-analysis",
      "frontend-skill",
      "merge-drafts",
      "vetter",
      "insights",
    ];

    expect(Object.keys(skillsRegistry).sort()).toEqual(expectedSkills.sort());

    const allKeys = Object.keys(skillsRegistry);
    const uniqueKeys = [...new Set(allKeys)];
    expect(allKeys.length).toBe(uniqueKeys.length);
    expect(allKeys.length).toBe(12);
  });
});
