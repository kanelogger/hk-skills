import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { detectAgent, detectOs } from "../../src/utils/env.js";

describe("detectAgent", () => {
  let originalHkAgent: string | undefined;
  const configDir = resolve(homedir(), ".hk-skills");
  const configPath = resolve(configDir, "config.json");

  beforeEach(() => {
    originalHkAgent = process.env.HK_AGENT;
    delete process.env.HK_AGENT;
    rmSync(configPath, { force: true });
  });

  afterEach(() => {
    if (originalHkAgent !== undefined) {
      process.env.HK_AGENT = originalHkAgent;
    } else {
      delete process.env.HK_AGENT;
    }
    rmSync(configPath, { force: true });
  });

  it("returns HK_AGENT env var when set", () => {
    process.env.HK_AGENT = "cursor";
    expect(detectAgent()).toBe("cursor");
  });

  it("falls back to config file agent when env var is unset", () => {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ agent: "windsurf" }), "utf-8");
    expect(detectAgent()).toBe("windsurf");
  });

  it("falls back to default 'opencode' when env var and config are missing", () => {
    expect(detectAgent()).toBe("opencode");
  });

  it("treats empty string env var as unset and falls back to config", () => {
    process.env.HK_AGENT = "";
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ agent: "claude" }), "utf-8");
    expect(detectAgent()).toBe("claude");
  });

  it("treats empty string env var as unset and falls back to default when config missing", () => {
    process.env.HK_AGENT = "";
    expect(detectAgent()).toBe("opencode");
  });
});

describe("detectOs", () => {
  let originalHkOs: string | undefined;
  const configDir = resolve(homedir(), ".hk-skills");
  const configPath = resolve(configDir, "config.json");

  beforeEach(() => {
    originalHkOs = process.env.HK_OS;
    delete process.env.HK_OS;
    rmSync(configPath, { force: true });
  });

  afterEach(() => {
    if (originalHkOs !== undefined) {
      process.env.HK_OS = originalHkOs;
    } else {
      delete process.env.HK_OS;
    }
    rmSync(configPath, { force: true });
  });

  it("returns HK_OS env var when set", () => {
    process.env.HK_OS = "linux";
    expect(detectOs()).toBe("linux");
  });

  it("falls back to config file os when env var is unset", () => {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ os: "win32" }), "utf-8");
    expect(detectOs()).toBe("win32");
  });

  it("falls back to process.platform when env var and config are missing", () => {
    expect(detectOs()).toBe(process.platform);
  });

  it("treats empty string env var as unset and falls back to config", () => {
    process.env.HK_OS = "";
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ os: "darwin" }), "utf-8");
    expect(detectOs()).toBe("darwin");
  });

  it("treats empty string env var as unset and falls back to default when config missing", () => {
    process.env.HK_OS = "";
    expect(detectOs()).toBe(process.platform);
  });
});
