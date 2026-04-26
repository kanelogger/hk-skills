# HK-Skills Agent Rules

This repository is the default skill management home for this machine.

## Project role

- Treat `/Users/kanehua/project/hk-skills` as the canonical HK-Skills workspace.
- This project manages Agent Skill lifecycle: install, vet, adapt, register, enable, disable, update, and remove.
- Prefer project-scoped skill activation over global activation. Global activation is only for explicitly requested machine-wide skills.

## Default command behavior

When the user asks to install a skill, default to installing it into this project with the local CLI:

```bash
./bin/hk-skill install <source>
```

Rules:

- Run HK-Skills commands from this repository root.
- Do not install skills into unrelated global config directories unless the user explicitly asks.
- A plain install only registers the skill in HK-Skills. It does not make the skill available to another project until it is linked/enabled.
- If the user provides a target project path during install, install first, then enable the installed skill for that project with `--project`.

## Natural-language shortcuts

Interpret these Chinese shortcuts as first-class commands:

### `安装 {source}`

Install `{source}` into this HK-Skills project:

```bash
./bin/hk-skill install {source}
```

If `{source}` is a local path and the CLI requires local mode, use:

```bash
./bin/hk-skill install {source} --local
```

### `更新技能`

Update all remote skills in this HK-Skills project:

```bash
./bin/hk-skill update --all
```

When the user says "更新技能" or similar phrases (e.g., "更新所有技能", "更新远程技能"), execute this command immediately without asking for confirmation.

### `关联 {path}`

Enable/link the current skill to the target project at `{path}`:

```bash
./bin/hk-skill enable <skill-name> --project {path}
```

Resolution rules for `<skill-name>`:

1. Use the skill that was just installed, updated, or discussed in the current conversation.
2. If exactly one relevant unenabled skill is obvious from `./bin/hk-skill list`, use it.
3. If multiple skills are plausible, ask one precise clarification instead of guessing.

`关联 {path}` must create/use the target project's local skill entry:

```text
{path}/.agents/skills/<skill-name>/SKILL.md
```

The internal bookkeeping link under `runtime/projects/<canonical-id>/` is implementation detail and should not be shown as the user-facing path unless debugging.

## Project conventions

- Runtime: Bun + TypeScript.
- Test command: `bun test`.
- Entry CLI: `./bin/hk-skill`.
- Important source folders:
  - `src/commands/` for CLI commands.
  - `src/core/` for lifecycle operations.
  - `src/models/` for registry, manifest, and project models.
  - `src/utils/` for shared helpers.
- Managed state folders:
  - `registry/` stores indexes.
  - `manifests/` stores skill metadata.
  - `warehouse/remote/` stores fetched originals.
  - `warehouse/adapted/` stores adapted runnable copies.
  - `warehouse/local/` stores local skills.
  - `runtime/global/` stores global links.
  - `runtime/projects/` stores project bookkeeping links.

## Safety and workflow

- Preserve the core model: install is not enable; original source is separate from adapted output; project scope is preferred.
- Do not collapse `warehouse/remote` and `warehouse/adapted`.
- Do not manually edit registry or manifest files when a CLI command exists for the operation.
- Do not enable skills globally unless the user explicitly says global.
- After code changes, run the narrowest relevant tests first, then `bun test` when the change affects lifecycle behavior.
- Never commit changes unless the user explicitly asks.
