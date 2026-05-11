---
name: pi-sherlock-ripgrep
description: Advanced pattern-based file content search powered by ripgrep — multiline, count mode, PCRE2, fixed strings, and raw rg access
---

# pi-sherlock-ripgrep: Advanced File Content Search

**Trigger:** You need ripgrep features that `search` does NOT expose. Default to `search` — only reach for `ripgrep` when you specifically need one of the features below.

## When to use `ripgrep` vs `search`

```
Can you express your need with `search`?
  ├── YES → Use `search` (simpler API, same engine, gitignore-aware)
  └── NO  → Use `ripgrep` for:
        ├── Multiline patterns        → multiline: true
        ├── Match counts per file     → mode: "count"
        ├── List files with matches   → mode: "filesWithMatches"
        ├── Search hidden / dotfiles  → hidden: true
        ├── Bypass .gitignore         → noIgnore: true
        ├── Literal strings (no regex)→ fixedStrings: true
        ├── PCRE2 patterns (lookahead)→ use rg --engine=pcre2 via shell
        └── Hard timeout              → timeoutMs: N
```

## Feature Reference

| Need | Parameter | Example |
|------|-----------|---------|
| Cross-line match | `multiline: true` | `pattern: "start.*?end"` spanning lines |
| Count hits per file | `mode: "count"` | How many TODOs per file? |
| Just file paths | `mode: "filesWithMatches"` | Which files import lodash? |
| Dotfiles / `.env` | `hidden: true` | Search `.github/` workflows |
| Vendor / generated | `noIgnore: true` | Search `node_modules` |
| Special chars literal | `fixedStrings: true` | Match `$var->method()` verbatim |
| Prevent runaway | `timeoutMs: 5000` | Large repos or slow patterns |
| Limit line width | `maxColumns: 200` | Suppress minified-file noise |
| Context lines | `contextBefore` / `contextAfter` | Inspect match surroundings |

## ripgrep 15 Highlights (what's new)

- **PCRE2 engine** — lookahead, lookbehind, named groups. Enabled with `--engine=pcre2` (via `shell_enhanced` when needed). Check with: `rg --version` (shows `+pcre2` if available).
- **`--hyperlink-format`** — clickable file links in terminals. Not exposed in the tool wrapper but available via `shell_enhanced`.
- **`--trim`** — strip leading whitespace from match output.
- **`--json`** — machine-readable NDJSON output (use via `shell_enhanced` for pipeline work).
- **`--sort` / `--sortr`** — sort results by `path`, `modified`, `accessed`, `created`.
- **`--passthru`** — print non-matching lines too (grep -v alternative).

## Guidelines

1. **Default is `search`** — `ripgrep` is the escape hatch for advanced flags.
2. Use `mode: "count"` + `sort` in your head to quickly find hot spots.
3. `mode: "filesWithMatches"` → fast coarse filter → then `search` for detailed matches.
4. `fixedStrings: true` when your pattern contains `.`, `*`, `$`, `(`, `)` you want literally.
5. `multiline: true` with `.*?` patterns: remember this is still line-buffered; use with care on huge files.
6. For PCRE2 advanced patterns (lookahead, lookbehind), use `shell_enhanced` with `rg --engine=pcre2`.

## Do NOT use for

- Standard content search → `search`
- AST-aware code patterns → `semgrep` or `ast_grep`
- File discovery by name → `find_files` or `fuzzy_find`
- Conceptual / semantic search → `concept_search`

## Output

All outputs are truncated to **200 lines / 10 000 chars** with a diagnostic note. Use `mode: "count"` or `mode: "filesWithMatches"` when you only need aggregate info to stay within limits.
