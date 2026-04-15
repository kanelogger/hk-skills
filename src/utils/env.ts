import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

function readConfigField(field: "agent" | "os"): string | undefined {
  const configPath = resolve(homedir(), ".hk-skills", "config.json");
  if (!existsSync(configPath)) {
    return undefined;
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const value = parsed[field];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  } catch {
    return undefined;
  }
}

export function detectAgent(): string {
  const envAgent = process.env.HK_AGENT;
  if (typeof envAgent === "string" && envAgent.trim() !== "") {
    return envAgent;
  }

  const configAgent = readConfigField("agent");
  if (configAgent !== undefined) {
    return configAgent;
  }

  return "opencode";
}

export function detectOs(): string {
  const envOs = process.env.HK_OS;
  if (typeof envOs === "string" && envOs.trim() !== "") {
    return envOs;
  }

  const configOs = readConfigField("os");
  if (configOs !== undefined) {
    return configOs;
  }

  return process.platform;
}
