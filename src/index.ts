#!/usr/bin/env bun
import { Command } from "commander";
import { init } from "./commands/init.js";
import { install } from "./commands/install.js";
import { list } from "./commands/list.js";
import { enable } from "./commands/enable.js";
import { disable } from "./commands/disable.js";
import { remove } from "./commands/remove.js";
import { reset } from "./commands/reset.js";
import { update } from "./commands/update.js";
import { vet } from "./commands/vet.js";
import { adaptCommand } from "./commands/adapt.js";
import { catalog } from "./commands/catalog.js";
import { getRootPath } from "./utils/paths.js";

const program = new Command();

program
  .name("hk-skill")
  .description("HK Skills CLI - manage and orchestrate skills")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize the HK Skills directory structure and migrate legacy data")
  .action(() => {
    init(getRootPath());
  });

program
  .command("install <source>")
  .description("Install a skill from a remote URL or local path")
  .option("--local", "Treat source as a local path")
  .option("--subpath <path>", "Subpath within the repository")
  .action(async (source: string, options: { local?: boolean; subpath?: string }) => {
    await install(getRootPath(), source, options);
  });

program
  .command("list")
  .description("List installed skills")
  .action(() => {
    list(getRootPath());
  });

program
  .command("vet <name>")
  .description("Vet a skill for correctness")
  .action((name: string) => {
    vet(getRootPath(), name);
  });

program
  .command("enable <name>")
  .description("Enable a skill globally or for a specific project")
  .option("--global", "Enable globally (default)")
  .option("--project <path>", "Enable for a specific project")
  .action((name: string, options: { global?: boolean; project?: string }) => {
    enable(getRootPath(), name, options);
  });

program
  .command("disable <name>")
  .description("Disable a skill globally or for a specific project")
  .option("--global", "Disable globally (default)")
  .option("--project <path>", "Disable for a specific project")
  .action((name: string, options: { global?: boolean; project?: string }) => {
    disable(getRootPath(), name, options);
  });

program
  .command("remove [name]")
  .description("Remove an installed skill")
  .option("--unused", "Remove all skills that are not enabled")
  .option("--yes, -y", "Skip confirmation prompt")
  .action(async (name: string | undefined, options: { unused?: boolean; yes?: boolean }) => {
    await remove(getRootPath(), name, options);
  });

program
  .command("reset")
  .description("Reset project managed state (registry, manifests, runtime, adapted/remote) while preserving local sources")
  .option("--yes, -y", "Skip confirmation prompt")
  .action(async (options: { yes?: boolean }) => {
    await reset(getRootPath(), options);
  });

program
  .command("update [name]")
  .description("Update an installed remote skill")
  .option("--all", "Update all remote skills")
  .action(async (name: string | undefined, options: { all?: boolean }) => {
    await update(getRootPath(), name, options);
  });

program
  .command("adapt <name>")
  .description("Re-adapt a skill to the current environment")
  .action(async (name: string) => {
    await adaptCommand(getRootPath(), name);
  });

program
  .command("catalog")
  .description("Generate searchable skill catalog as docs/catalog.md")
  .action(() => {
    catalog(getRootPath());
  });

program.parse();
