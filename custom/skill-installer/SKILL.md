---
name: skill-installer
description: Stage third-party skills into this repo's remote/ area from a curated list or a GitHub repo path, then adapt and promote them into skills/. Use when a user asks to list candidate skills, stage a remote skill, or intake a GitHub-hosted skill for local adaptation.
metadata:
  short-description: Stage remote skills for local adaptation and promotion
---

# Skill Installer

Helps intake third-party skills into this repo. By default the listing source is https://github.com/openai/skills/tree/main/skills/.curated, but users can also provide other GitHub locations.

The workflow in this repo is:
1. Inspect the upstream source and run `vetter` before staging any remote skill.
2. Stage vetted remote skills into `remote/`.
3. Record their upstream source in `remote/menu.md`.
4. Adapt them for the current agent architecture and local darwin/zsh environment.
5. If the imported skill is English-only, add a same-level Chinese introduction such as `cn.md` during adaptation.
6. Promote the finished version into `skills/`.
7. Let projects consume `skills/` via symlink.

Use the helper scripts based on the task:
- List skills when the user asks what is available, or if the user uses this skill without specifying what to do. Default listing is `.curated`, but you can pass `--path skills/.experimental` when they ask about experimental skills.
- Stage from the curated list when the user provides a skill name.
- Stage from another repo when the user provides a GitHub repo/path (including private repos).

`SKILL.md` orchestrates the workflow and user-facing guidance. The helper scripts should only do deterministic GitHub, network, and file operations such as listing or staging skill directories.

## Communication

When listing skills, output approximately as follows, depending on the context of the user's request. If they ask about experimental skills, list from `.experimental` instead of `.curated` and label the source accordingly:
"""
Skills from {repo}:
1. skill-1
2. skill-2 (already staged)
3. skill-3 (already staged, already installed)
4. ...
Which ones would you like vetted first and then staged into `remote/` for adaptation?
"""

After staging a skill, tell the user where it landed in `remote/`, confirm that its upstream source was recorded in `remote/menu.md`, and describe the next adaptation steps before promotion into `skills/`.

## Scripts

All of these scripts use network. If the current environment restricts network access, request permission before running them.

- `python3 custom/skill-installer/scripts/list-skills.py` (prints skills list with staged/installed annotations)
- `python3 custom/skill-installer/scripts/list-skills.py --format json`
- Example (experimental list): `python3 custom/skill-installer/scripts/list-skills.py --path skills/.experimental`
- `python3 custom/skill-installer/scripts/install-skill-from-github.py --repo <owner>/<repo> --path <path/to/skill> [<path/to/skill> ...]`
- `python3 custom/skill-installer/scripts/install-skill-from-github.py --url https://github.com/<owner>/<repo>/tree/<ref>/<path>`
- Example (stage into `remote/`): `python3 custom/skill-installer/scripts/install-skill-from-github.py --repo openai/skills --path skills/.experimental/<skill-name>`
- Example (promote after adaptation): `cp -R remote/<skill-name> skills/<skill-name>`
- Example (project symlink from repo root on darwin/zsh): `ln -s "$(pwd)/skills" ../my-project/.agents/skills`

## Behavior and Options

- Defaults to direct download for public GitHub repos.
- If download fails with auth/permission errors, falls back to git sparse checkout.
- Aborts if the destination skill directory already exists, if the same skill already exists in `skills/` while staging into `remote/`, or if the imported skill tree contains symlinks.
- Stages into `<repo-root>/remote/<skill-name>` by default.
- Records staged sources in `<repo-root>/remote/menu.md` when using the repo-local staging flow.
- Multiple `--path` values stage multiple skills in one run, each named from the path basename unless `--name` is supplied.
- Options: `--ref <ref>` (default `main`), `--dest <path>` for controlled repo-internal or temporary QA overrides, `--method auto|download|git`.

## Notes

- Curated listing is fetched from `https://github.com/openai/skills/tree/main/skills/.curated` via the GitHub API. If it is unavailable, explain the error and exit.
- Private GitHub repos can be accessed via existing git credentials or optional `GITHUB_TOKEN`/`GH_TOKEN` for download.
- Git fallback tries HTTPS first, then SSH.
- Remote intake does not publish automatically. Promotion into `skills/` only happens after vetting and local adaptation.
- For unknown third-party skills, use `vetter` before running the staging script rather than after copying files into `remote/`.
- During adaptation, check whether the imported skill needs a same-level Chinese companion file such as `cn.md`.
- Listing annotations come from this repo's `remote/` and `skills/` directories.
