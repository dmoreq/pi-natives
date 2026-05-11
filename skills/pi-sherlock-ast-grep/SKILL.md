---
name: pi-sherlock-ast-grep
description: Structural code search & refactoring via AST patterns using ast-grep — precise structural matching with metavariables and code rewriting
---

# pi-sherlock-ast-grep: Structural Search & Refactoring

**Trigger:** Find or transform CODE STRUCTURES with metavariable capture (`$X`, `$$$ARGS`). Understand or rewrite code patterns — not security audits (→ `semgrep`).

## semgrep vs ast_grep — choose one

```
ast_grep  → "Find this pattern so I can understand or rewrite it"
semgrep   → "Does this code have bugs or security issues?"
```

| Intent | Tool |
|--------|------|
| Find all `eval()` calls, capture args | **`ast_grep`** |
| Refactor `oldFn(a, b)` → `newFn(a, b)` | **`ast_grep`** with `rewrite` |
| Find all method calls on any object | **`ast_grep`** with `$O.method($$$ARGS)` |
| Security vulnerability scan | `semgrep` |
| Simple text like `TODO` | `search` |
| Conceptual file discovery | `concept_search` |

## Metavariable Syntax

| Syntax | Matches | Example |
|--------|---------|---------|
| `$X` | Any single AST node | `const $X = $Y` |
| `$$$X` | Zero or more nodes (rest/spread) | `fn($$$ARGS)` |
| `$_` | Any node, not captured | `if ($_) { $$$BODY }` |
| `$A` … `$Z` | Named captures (reusable in rewrite) | `$OBJ.$METHOD($$$A)` |

## Strictness Levels

| Level | Behavior | Use When |
|-------|----------|----------|
| `smart` (default) | Ignores trivial source nodes (comments, whitespace) | General-purpose matching |
| `ast` | Matches only AST nodes | Exact structural match |
| `relaxed` | AST nodes minus comments | When comments are noise |
| `signature` | AST minus comments and text | Structural shape only |
| `template` | Text only, ignores node kinds | String-template matching |
| `cst` | Exact CST match | Debug / very strict |

## ast-grep 0.42 Capabilities

### `run` — One-shot search or rewrite (the `ast_grep` tool uses this)
```
pattern: "$LOGGER.log($$$MSG)"
language: "ts"
rewrite: "$LOGGER.debug($$$MSG)"    # optional
strictness: "smart"                 # optional
```

**New flags exposed in 0.42:**
- **`--selector <KIND>`** — match a sub-node kind within the pattern (e.g. `selector: "argument_list"` to match only the args portion)
- **`--files-with-matches`** — print only file paths, suppress match content (fast coarse filter)
- **`--json=pretty|stream|compact`** — structured JSON output (use `stream` for large result sets)
- **`--interactive` / `-i`** — confirm each rewrite interactively (via `shell_enhanced`)
- **`-U` / `--update-all`** — apply all rewrites without confirmation
- **Context lines** — `-A`, `-B`, `-C` for surrounding lines around each match

### `scan` — Rule-based scanning (use via `shell_enhanced`)
Run a directory of rule YAML files or a project config (`sgconfig.yml`):
```bash
ast-grep scan --config sgconfig.yml src/
```
Useful for enforcing team-wide patterns, deprecated API detection, or migration checks.

### `lsp` — Language server (IDE integration)
Start ast-grep as an LSP server for real-time structural linting in editors.

### `test` — Rule testing
Validate custom rules against test fixtures before deploying:
```bash
ast-grep test --config sgconfig.yml
```

## Guidelines

1. Always specify `language` for accurate AST parsing.
2. Use `$$$ARGS` to capture function arguments; `$X` for a single node.
3. Preview rewrites before applying: use `shell_enhanced` with `ast-grep run --json=pretty` first.
4. Use `rewrite` for safe automated refactoring — always back up or commit first.
5. Combine with `search` for text-based follow-up on matched files.
6. For large codebases, use `--files-with-matches` to get a file list first, then narrow.
7. Use `scan` + rule YAML for repeatable, team-wide pattern enforcement.

## Do NOT use for

- Security vulnerability detection → `semgrep`
- Simple text search → `search`
- Conceptual search → `concept_search`
- Filename search → `find_files` or `fuzzy_find`
- Code statistics → `count_lines`

## Output

All outputs are truncated to **200 lines / 10 000 chars**. For large result sets, use `--json=stream` via `shell_enhanced` or `--files-with-matches` to reduce output volume.
