import { describe, it, expect } from "bun:test";
import { SkillManifestSchema } from "../../src/models/manifest.js";

describe("SkillManifestSchema", () => {
  it("validates a full manifest", () => {
    const manifest = {
      name: "repo-analyzer",
      display_name: "Repo Analyzer",
      source: {
        type: "remote",
        repo: "https://github.com/example/skills",
        ref: "main",
        commit: "abc123",
      },
      status: {
        stage: "adapted",
        quality: "stable",
      },
      scope: {
        recommended: "project",
      },
      capabilities: ["repo-read", "dependency-analysis"],
      triggers: ["repo", "codebase"],
      dependencies: {
        tools: ["git", "node>=20"],
      },
      adapter: {
        target: "hk-agent",
        adapted_from: "claude-code",
      },
      localization: {
        zh_cn: true,
      },
      conflicts_with: ["repo-reader"],
      entry: {
        file: "SKILL.md",
      },
      skip_vet: true,
    };

    const result = SkillManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("fails when name is missing", () => {
    const manifest = {
      display_name: "Repo Analyzer",
    };

    const result = SkillManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("validates a minimal manifest with only name", () => {
    const manifest = {
      name: "repo-analyzer",
    };

    const result = SkillManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});
