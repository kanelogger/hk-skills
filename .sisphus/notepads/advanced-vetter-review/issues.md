# Code Quality Review - advanced-vetter

## Findings

### Critical Issue
- **src/core/vetter.ts:213-214** — Empty catch block around `require(rulesPath)` swallows all errors silently. If the advanced rules file is malformed or missing dependencies, security scanning is silently skipped with no warning or error emitted.

### Additional Concerns
- **src/core/vetter.ts** uses non-null assertions (`!`) at lines 72 and 246 (`swTokens[0]!`, `lines[i]!`). Prefer bounds checking or filter maps to avoid `!` casts.
- **tests/core/vetter.test.ts:186-210** — The "falls back when rules missing" test mutates the real filesystem by renaming `warehouse/local/advanced-vetter/rules.ts` to `.bak`. No `try/finally` guard means a mid-test crash leaves the rules file permanently missing, corrupting the workspace.
- **tests/commands/vet.test.ts:55** — Uses `as string` cast on mock call args. Could be tightened with proper type inference.

## Verdict
**REJECT** — The empty catch block is a production bug that defeats the security scanner's purpose.

## Build/Test Status
- `bun tsc --noEmit`: PASS
- `bun test`: 96 pass / 0 fail
- LSP diagnostics: Clean on all 6 files

