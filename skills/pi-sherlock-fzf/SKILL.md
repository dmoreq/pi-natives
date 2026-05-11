---
name: pi-sherlock-fzf
description: Fuzzy file path search powered by fzf — find files when you only remember part of their name
---

# pi-sherlock-fzf: Fuzzy File Path Search

**Trigger:** You sort-of know the file name but not the exact path. Query terms can be in any order and don't need to be contiguous.

## Tool Selection

```
Approximate / mistyped filename?  → fuzzy_find  (fzf)
Exact name, extension, or glob?   → find_files  (fd)
File CONTENTS?                    → search      (ripgrep)
Conceptual / topical discovery?   → concept_search
```

## How Fuzzy Matching Works

fzf scores paths by how closely query tokens appear (in order but non-contiguous) in the full relative path:

```
query: "auth mid"  →  matches: src/auth/middleware.ts  ✓
query: "user rep"  →  matches: packages/user/repository.ts  ✓
query: "mig sql"   →  matches: db/migrations/0001_init.sql  ✓
```

## Feature Reference

| Parameter | Effect |
|-----------|--------|
| `query` | Fuzzy terms (space-separated, any order) |
| `path` | Restrict search to this directory |
| `glob` | Filter by filename pattern (e.g. `"*.ts"`) |
| `limit` | Max results returned (default: 20) |

## fzf 0.72 Highlights

- **`--scheme=path`** — scoring scheme optimized for file paths (prioritizes path-component boundaries). This is implicitly the right scheme for file searches.
- **`--scheme=history`** — recency-weighted scoring for command history.
- **`--tiebreak`** — when scores are tied, sort by `length`, `chunk`, `pathname`, `begin`, `end`, or `index`.
- **`--style=full`** — richer UI with borders and labels (interactive mode via `shell_enhanced`).
- **`--popup` / `--tmux`** — spawn fzf in a tmux popup window (requires tmux 3.3+).
- **`--accept-nth`** — control which fields are printed on selection.
- **`--wrap`** — line wrapping for long paths.

For interactive selection UI, use `shell_enhanced` with raw `fzf` invocation.

## Guidelines

1. Query tokens match against the FULL relative path — include directory names for narrowing.
2. Use `path` to restrict scope: `path: "src/"` + `query: "middleware"`.
3. Use `glob` for type filtering: `glob: "*.ts"` with a fuzzy name query.
4. Results are paths only — follow with `search` or `read_enhanced` to inspect content.
5. Empty query returns ALL files (up to `limit`) — useful for exploration.
6. For interactive fuzzy selection (e.g. pick from a list), use `shell_enhanced` + raw `fzf`.

## Do NOT use for

- Searching file CONTENTS → `search`
- Exact filename / extension matching → `find_files`
- Conceptual / relevance-ranked content → `concept_search`
- Code structure matching → `semgrep` or `ast_grep`

## Output

A list of matched file paths, one per line. Truncated to **200 lines / 10 000 chars**. Increase `limit` or narrow scope with `path`/`glob`.
