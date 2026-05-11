---
name: pi-sherlock-search
description: DEFAULT regex content search powered by ripgrep — fast, gitignore-aware, structured output. Use for any precise pattern match in file contents.
---

# pi-sherlock-search: Default Content Search

**Trigger:** You have a PRECISE regex pattern and need to search file CONTENTS. This is your **default** content search — reach for it before any other search tool.

## Tool Selection

```
Precise regex in file contents?   → search        ← YOU ARE HERE (default)
Concept / natural language?       → concept_search
Multiline / hidden / count mode?  → ripgrep
File names / paths?               → find_files or fuzzy_find
Code structure / AST?             → semgrep or ast_grep
```

## Feature Reference

| Parameter | Effect | Example |
|-----------|--------|---------|
| `pattern` | Regex to match | `"log.*Error"`, `"function\\s+\\w+"` |
| `path` | File, directory, or glob | `"src/"`, `"**/*.ts"` |
| `i: true` | Case-insensitive match | Find `TODO`, `todo`, `Todo` |
| `glob` | Filter by filename pattern | `"*.test.ts"` |
| `type` | Filter by language alias | `"ts"`, `"py"`, `"rust"`, `"json"` |
| `contextBefore` | Lines before each match | `2` |
| `contextAfter` | Lines after each match | `3` |
| `maxCount` | Cap total matches returned | `50` |
| `skip` | Skip first N matches (pagination) | `20` |
| `gitignore: false` | Search gitignored files too | — |

## Output

Structured JSON with:
- `matchCount` — total matches found
- `fileCount` — number of files containing matches
- `filesSearched` — total files scanned
- `result` — formatted lines with path:linenum:content

## Critical Rules

1. **NEVER shell out** to `grep`, `rg`, `ag`, `ack`, `git grep`, `awk`, or `sed` for search — always use this tool.
2. Shelling out loses `.gitignore` semantics, bypasses output limits, and wastes tokens.
3. `search` uses ripgrep under the hood — same speed, structured output.

## When NOT to use `search`

| Need | Tool |
|------|------|
| Concept / idea, no exact pattern | `concept_search` |
| Multiline match | `ripgrep` with `multiline: true` |
| Count hits per file | `ripgrep` with `mode: "count"` |
| Files containing pattern (no content) | `ripgrep` with `mode: "filesWithMatches"` |
| Hidden / dotfiles | `ripgrep` with `hidden: true` |
| Literal string with special regex chars | `ripgrep` with `fixedStrings: true` |
| Code structure (function calls, classes) | `semgrep` or `ast_grep` |
| Filename discovery | `find_files` or `fuzzy_find` |

## Common Patterns

```
# Find all TODO/FIXME across TypeScript
pattern: "TODO|FIXME"  type: "ts"

# Find function definitions
pattern: "function\\s+\\w+"  path: "src/"

# Find import of a specific module
pattern: "from ['\"]lodash['\"]"  glob: "*.ts"

# Case-insensitive class name
pattern: "authService"  i: true  path: "src/"

# Find error handling patterns with context
pattern: "catch\\s*\\("  contextAfter: 3
```

## Output Size

Truncated to **200 lines / 10 000 chars**. Use `maxCount` to limit, `type`/`glob`/`path` to narrow scope, or `ripgrep` `mode: "count"` for aggregate stats.
