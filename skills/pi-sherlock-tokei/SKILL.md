---
name: pi-sherlock-tokei
description: Fast code line counter using tokei — count lines of code, comments, and blanks by programming language
---

# pi-sherlock-tokei: Code Line Counter

**Trigger:** You need codebase STATISTICS — line counts, language breakdowns, comment-to-code ratios. tokei COUNTS; it does NOT search.

## Tool Selection

```
Line counts / language stats?    → count_lines  (tokei)
Search code content?             → search       (ripgrep)
Find structural patterns?        → ast_grep
Security / quality issues?       → semgrep
Find files?                      → find_files   (fd)
```

## Feature Reference

| Intent | Parameters |
|--------|-----------|
| Full project summary | `paths: ["."]` (default) |
| Specific directory | `paths: ["src/", "tests/"]` |
| Per-file breakdown | `files: true` |
| Filter languages | `types: ["TypeScript", "Rust"]` |
| Skip build artifacts | `exclude: ["node_modules", "dist", "target"]` |
| Sort by code lines | `sort: "code"` |
| Reverse sort | `reverseSort: true` |
| Include dotfiles | `hidden: true` |
| Skip gitignore | `noIgnore: true` |

## tokei 14 Highlights

- **200+ languages** auto-detected from file extension.
- **`--streaming`** — output records as they are counted (useful for large repos): `simple` or `json` format. Use via `shell_enhanced` for real-time streaming.
- **`--compact` / `-C`** — suppress embedded language statistics (e.g., JS inside HTML). Keeps output clean for mixed files.
- **`--output json/yaml/cbor`** — machine-readable format for programmatic processing. Use via `shell_enhanced`:
  ```bash
  tokei --output json src/ | jq '.TypeScript'
  ```
- **`--no-ignore-dot`** — don't respect `.ignore` and `.tokeignore` files (separate from gitignore).
- **`--no-ignore-vcs`** — don't respect `.gitignore` (more granular than `noIgnore`).
- **`--num-format`** — format numbers as `commas` (1,234), `dots` (1.234), or `underscores` (1_234).
- **`--rsort`** — reverse-sort by a column (equivalent to `sort` + `reverseSort: true`).
- **Hidden language totals** — tokei detects embedded languages (JS in HTML, SQL in Python strings). Use `--compact` to suppress.

## Sorting Column Values

`"files"` | `"lines"` | `"code"` | `"comments"` | `"blanks"`

## Guidelines

1. Default to workspace root; use `paths` to narrow scope on monorepos.
2. `sort: "code"` shows highest-impact languages first.
3. Use `exclude` to skip build artifacts — they skew numbers significantly.
4. Use `files: true` + `types: ["TypeScript"]` to find the largest/most complex files.
5. For machine-readable output, use `shell_enhanced` with `tokei --output json` + `jq`.
6. Use `--compact` when you don't care about embedded language breakdown.
7. Combine with `find_duplicates` after seeing large files: `count_lines` → `find_duplicates`.

## Do NOT use for

- Searching code content → `search` or `ripgrep`
- Structural code search → `ast_grep`
- Security / linting analysis → `semgrep`
- Finding files by name → `find_files` or `fuzzy_find`
- Conceptual discovery → `concept_search`

## Output

A formatted table with columns: Language, Files, Lines, Code, Comments, Blanks. Truncated to **200 lines / 10 000 chars**. Use `types` filter or `--output json` via `shell_enhanced` for large projects.
