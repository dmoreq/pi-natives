---
name: pi-sherlock
description: High-performance file search, structural analysis, and AI-agent-optimized core tools — modular TypeScript architecture with 14 specialized tools
---

# pi-sherlock: Tool Selection Guide

14 specialized tools for search, analysis, and file operations. Use this skill to pick the right tool fast.

## Decision Table

| Intent | Primary Tool | Fallback / Advanced |
|--------|-------------|---------------------|
| Exact regex in file contents | **`search`** | `ripgrep` (multiline, count, hidden) |
| Concept / idea, no exact pattern | **`concept_search`** | — |
| Know the filename or extension | **`find_files`** | — |
| Approximate / fuzzy filename | **`fuzzy_find`** | — |
| Code structure / security audit | **`semgrep`** | — |
| AST search or automated refactor | **`ast_grep`** | — |
| Lines of code, language stats | **`count_lines`** | — |
| Copy-paste / duplicate blocks | **`find_duplicates`** | — |
| Read large file efficiently | **`read_enhanced`** | builtin `read` (small files) |
| Atomic / streaming file write | **`write_enhanced`** | builtin `write` (simple) |
| AST-aware edit with preview | **`edit_enhanced`** | builtin `edit` (verbatim hunks) |
| Structured shell / JSON output | **`shell_enhanced`** | builtin `bash` (interactive TUI) |
| Repo topology with git status | **`ls_enhanced`** | `find_files` (flat list) |

## Tool Quick Reference

### Content Search
- **`search`** — DEFAULT regex search (ripgrep, gitignore-aware). Use for any precise pattern.
- **`ripgrep`** — Escape hatch for advanced rg: multiline, count/filesWithMatches mode, hidden files, PCRE2, fixed strings, timeouts.
- **`concept_search`** — BM25 relevance ranking for natural-language / conceptual queries.

### File Discovery
- **`find_files`** (fd) — Exact name, extension, glob, type. Parallelized, smart-case, gitignore-aware.
- **`fuzzy_find`** (fzf) — Approximate path matching. Terms in any order. Returns paths, not content.

### Structural Analysis
- **`semgrep`** — Security, linting, SAST. Rule packs (`auto`, `p/secrets`, `p/r2c-security-audit`). Pattern mode or config mode. Supports `--autofix`.
- **`ast_grep`** — AST search + rewrite with metavariables (`$X`, `$$$ARGS`). Scan mode for rule configs. Interactive rewrite (`-U`).

### Code Metrics
- **`count_lines`** (tokei) — LOC / comments / blanks. 200+ languages, per-file breakdown, JSON output.
- **`find_duplicates`** (jscpd) — Exact and near-duplicate blocks. `strict` / `mild` / `weak` modes.

### Enhanced Core (AI-Optimized)
- **`read_enhanced`** — AST skeleton, jq/yq slicing, bat highlighting. Smart truncation.
- **`write_enhanced`** — Atomic temp+rename, streaming, `.bak` snapshots.
- **`edit_enhanced`** — ast-grep rewrites with preview + backup. Literal fallback for non-code.
- **`shell_enhanced`** — Nushell JSON pipelines → Bun → bash fallbacks.
- **`ls_enhanced`** — broot topology + native fs walker. Git status codes, depth/filter control.

## Critical Rules

1. **Never shell out** to `grep`, `rg`, `find`, `ls` — always use pi-sherlock tools.
2. **`search` is default** for content — only use `ripgrep` when you need multiline/count/hidden/PCRE2/fixed-strings.
3. **`semgrep` ≠ `ast_grep`** — semgrep for security/linting, ast_grep for search+refactor.
4. **Token efficiency** — all tools auto-truncate at 200 lines / 10 000 chars with a diagnostic note.

## Tool Combinations

| Workflow | Chain |
|----------|-------|
| Security audit | `semgrep` → `search` (verify call sites) |
| Find + analyze | `find_files` → `semgrep` or `ast_grep` |
| Search + refactor | `search` → `ast_grep` (rewrite) |
| Metrics + cleanup | `count_lines` → `find_duplicates` → `ast_grep` |
| Read + edit | `read_enhanced` → `edit_enhanced` |

## Binary Dependencies

| Binary | Tools | Status |
|--------|-------|--------|
| `rg` (ripgrep 15+) | `search`, `ripgrep` | **Required** |
| `fd` (fd 10+) | `find_files` | **Required** |
| `fzf` (0.50+) | `fuzzy_find` | **Required** |
| `semgrep` (1.100+) | `semgrep` | **Required** |
| `ast-grep` / `sg` (0.30+) | `ast_grep`, `read_enhanced`, `edit_enhanced` | Optional (fallback: native) |
| `tokei` (14+) | `count_lines` | Optional |
| `jscpd` (4+) | `find_duplicates` | Optional |
| `jq` | `read_enhanced` | Optional (fallback: native JSON) |
| `yq` | `read_enhanced` | Optional (fallback: line excerpts) |
| `bat` | `read_enhanced` | Optional (fallback: plain text) |
| `nu` (nushell) | `shell_enhanced` | Optional (fallback: Bun → bash) |
| `broot` / `br` | `ls_enhanced` | Optional (fallback: native walker) |
