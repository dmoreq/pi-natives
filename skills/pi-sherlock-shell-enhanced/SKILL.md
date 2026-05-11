---
name: pi-sherlock-shell-enhanced
description: Structured shell execution — Nushell JSON pipelines first, Bun/bash fallback — eliminates free-text parsing for tabular CLI output
---

# pi-sherlock-shell-enhanced: Structured Shell Execution

**Trigger:** You need to run a shell command and get **structured, parseable output** (tabular data, JSON records). Use when free-text stdout would require fragile parsing.

## Tool Selection

```
Need structured / tabular output?  → shell_enhanced  ← YOU ARE HERE
Interactive TUI / terminal UI?     → builtin bash
Simple one-liner, output is plain? → builtin bash
Git log / status as JSON records?  → shell_enhanced
ls / ps / env as JSON rows?        → shell_enhanced
```

## Execution Tiers

```
1. Nushell (nu)        — JSON pipelines via `| to json`
                          Recognised commands get curated Nu transforms
2. Bun.$ (sh -c)       — POSIX fast path (when fallbackToBun: true, default)
                          Used only when Nu succeeds with exit 0
3. bash / sh           — Final fallback when Nu fails or fallbackToBun: false
```

## Parameters

| Parameter | Effect | Default |
|-----------|--------|---------|
| `command` | Shell command to run | required |
| `enforceJson` | Wrap known CLIs in Nushell `\| to json` | `true` |
| `fallbackToBun` | Try Bun.$ before bash on Nu failure | `true` |
| `cwd` | Working directory | workspace cwd |
| `env` | Extra env vars merged into process | `{}` |
| `timeout` | Wall-clock timeout (ms) | 120 000 |

## Commands That Get Auto-Enhanced (enforceJson: true)

| Command | Enhancement |
|---------|-------------|
| `ls -la` | `ls \| select name type size modified \| to json` |
| `ps aux` | `ps \| to json` |
| `env` | `$env \| to json` |
| `git log -n 20` | Parsed git log records as JSON |
| `git status` | Parsed status records as JSON |

## Usage Patterns

```
# Git log as structured records
command: "git log -n 20 --oneline"

# Environment snapshot
command: "env"

# Process list
command: "ps aux"

# Directory listing with sizes
command: "ls -la src/"

# Run tokei with JSON output for programmatic use
command: "tokei --output json src/"
enforceJson: false   ← raw JSON, not Nu-wrapped

# PCRE2 ripgrep (not exposed in ripgrep tool)
command: "rg --engine=pcre2 '(?<=from )\\w+' src/"
enforceJson: false

# ast-grep interactive scan
command: "ast-grep scan --config sgconfig.yml src/"
enforceJson: false
```

## When to use `enforceJson: false`

- When you want raw CLI stdout without Nu transformation.
- When the command already outputs JSON (tokei `--output json`, ast-grep `--json`, rg `--json`).
- When Nu's table-to-JSON conversion would mangle the format.

## Performance Metadata

Output includes `startupMs` (Nu spawn overhead) and `execMs` (streaming + wait). If Nu is slow to start, switch to `enforceJson: false` with `fallbackToBun: true` for a faster POSIX path.

## Guidelines

1. Use `shell_enhanced` over raw bash when you expect **tabular / record-shaped** output.
2. Use `enforceJson: false` when the command already produces JSON or when Nu's wrapping is unwanted.
3. Use `cwd` to run commands in a specific directory without `cd &&` hacks.
4. Use `timeout` to prevent runaway processes (e.g. large semgrep scans).
5. Use `env` to inject secrets or config without polluting the shell environment.
6. **Do not use** for interactive TUIs (`vim`, `htop`, `fzf --interactive`) — use builtin bash.

## Do NOT use for

- Interactive terminal UIs → builtin `bash`
- File content search → `search` (never shell out to `grep` or `rg`)
- File operations with pi-sherlock tools available → prefer the dedicated tool
