---
name: pi-sherlock-semgrep
description: AST-aware static analysis and pattern-based code search using Semgrep — find bugs, security issues, and code smells
---

# pi-sherlock-semgrep: AST-Aware Code Analysis

**Trigger:** Match CODE STRUCTURE (function calls, control flow, class definitions) that regex cannot reliably match, OR run security/quality rule packs across a codebase.

## When to use semgrep

| Pattern | Tool | Why |
|---------|------|-----|
| `eval(...)` | **`semgrep`** | Function call — AST-aware |
| `$X == $X` | **`semgrep`** | Self-comparison — AST tracks vars |
| Hardcoded secrets | **`semgrep`** with `config: "p/secrets"` | Rule pack |
| SQL injection | **`semgrep`** with `config: "p/r2c-security-audit"` | Rule pack |
| `TODO` | `search` | Plain text |
| `function\s+\w+` | `search` | Regex pattern |
| "where is auth handled?" | `concept_search` | Conceptual |
| Find + rewrite a pattern | `ast_grep` | Structural refactor |

## Two Modes

### Pattern mode — ad-hoc structural search
```
pattern: "eval(...)"
language: "ts"
severity: "WARNING"    # optional filter: ERROR | WARNING | INFO
```

### Config mode — predefined rule packs
```
config: "auto"                    # auto-detect language, run relevant rules
config: "p/default"               # curated default rules
config: "p/secrets"               # hardcoded credentials, tokens, keys
config: "p/r2c-security-audit"    # OWASP, injection, path traversal, XSS
config: "p/owasp-top-ten"         # OWASP Top 10
config: "p/javascript"            # JS/TS best practices
config: "p/python"                # Python best practices
config: "./rules/"                # path to local rule YAML files
```

## Semgrep 1.157 Capabilities

### `scan` — main analysis command (what the `semgrep` tool uses)
- **`--autofix`** — automatically apply suggested fixes when rules define a `fix` clause.
- **`--dryrun`** — preview autofixes without writing to disk.
- **`--incremental`** — only scan files changed since last scan (requires `--experimental`).
- **`--exclude` / `--include`** — glob patterns to filter scanned files.
- **`--severity ERROR`** — filter output to only show findings at or above a level.
- **`--json`** — machine-readable output (use with `shell_enhanced` for pipelines).

### `mcp` — Model Context Protocol server
Semgrep can run as an MCP server for AI agent integration:
```bash
semgrep mcp
```
Enables real-time rule evaluation from AI agent tooling.

### `ci` — CI/CD mode
Scans only git-diff changes (for PRs / merge requests):
```bash
semgrep ci --config auto
```

### Severity levels
`ERROR` > `WARNING` > `INFO` — use `severity: "ERROR"` to reduce noise in large codebases.

## Guidelines

1. Always specify `language` when using a `pattern`.
2. Start with `config: "auto"` for a quick scan; narrow to specific packs for deep audits.
3. Use `severity: "ERROR"` to cut noise; expand to `"INFO"` to see everything.
4. Combine: `semgrep` finds the vulnerability, `search` verifies all call sites.
5. Use `--autofix` + `--dryrun` first, then re-run without `--dryrun` to apply.
6. For team enforcement, store rules as YAML in `./rules/` and run `config: "./rules/"`.

## Do NOT use for

- Simple text / string matching → `search`
- Concept-based file discovery → `concept_search`
- Filename search → `find_files` or `fuzzy_find`
- Structural refactoring → `ast_grep`

## Output

All outputs are truncated to **200 lines / 10 000 chars**. For large audits, use `severity: "ERROR"` first, or pipe `--json` output via `shell_enhanced` for full results.
