---
name: advanced-vetter
version: 1.0.0
description: Advanced security-first skill vetting for AI agents. Programmatic rule-based checks for suspicious patterns, credential leaks, and obfuscated code.
skip_vet: true
---

# Advanced Vetter 🔒

Advanced security vetting protocol that operates programmatically on skill code. Detects dangerous patterns, credential leaks, and suspicious obfuscation before installation.

## When to Use

- During automated skill installation pipelines
- As a secondary check after manual `vetter` review
- When scanning skills from unknown or external sources
- Anytime code needs programmatic security validation

## Check Categories

### Execution Hazards
Detects patterns that execute arbitrary code or shell commands:
- `curl | bash` / `wget | bash` pipelines
- `eval(...)` and `new Function(...)` usage
- `rm -rf /` and similar destructive commands
- `child_process` imports in Node.js

### Credential & Privacy Access
Flags attempts to read sensitive directories and files:
- `.ssh directory` — SSH keys and known hosts
- `.aws directory` — AWS credentials and config
- `.config directory` — Application secrets and tokens

### Obfuscation & Encoding
Catches base64 decoding patterns commonly used to hide malicious code:
- `atob(...)` in browser contexts
- `Buffer.from(..., 'base64')` in Node.js contexts

### Secret Leaks (Warnings)
Identifies hardcoded secrets and environment variable access:
- Hardcoded API keys, tokens, passwords
- `process.env` reads
- `.env` file access

## Output

This skill is consumed programmatically by `src/core/vetter.ts`. The accompanying `rules.ts` exports typed security rules and a stopword list for additional heuristic filtering.
