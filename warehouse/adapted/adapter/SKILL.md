---
name: adapter
version: 1.0.0
description: Prompt rewriting engine that adapts SKILL.md content to the current Agent architecture and OS.
---

# Adapter 🔄

Programmatic prompt rewriting engine for localizing skills. Adapts SKILL.md content written for one agent or operating system to the current runtime environment using simple regex-based rules.

## When to Use

- During skill installation when the source skill was designed for a different agent
- When migrating skills across operating systems (Linux, macOS, Windows)
- As part of the `adapt` pipeline to rewrite agent-specific terminology
- Anytime a skill needs agent or OS localization before use

## Rewrite Rules

### Agent Normalization
Replaces mentions of known agents with the target agent name:
- `Claude Code` → target agent
- `Cursor` → target agent
- `GitHub Copilot` / `Copilot` → target agent

### OS Path Normalization
Rewrites common home directory path patterns based on the target OS:
- `/home/user` → `/Users/user` (when target OS is darwin)
- `/Users/user` → `/home/user` (when target OS is linux)

## Output

This skill is consumed programmatically by `src/core/adapter.ts`. The accompanying `engine.ts` exports typed rewrite functions and a context interface for rule-based transformations.
