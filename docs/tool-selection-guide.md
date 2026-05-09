# Tool selection guide

Quick reference for choosing among pi-sherlock’s **14** tools. Use this with **[Smart routing](./smart-routing.md)** when designing prompts or interpreting `SmartRouter` output.

## Legend

- **Primary** — First tool to invoke for the task when binaries are available.  
- **Alternates** — Close substitutes (routing secondaries/fallbacks or manual choice).  
- **Enhanced** — pi-sherlock tools optimized for structured or token-efficient outputs; builtins are outside this table.

## Complete matrix (all 14 tools)

| Tool | Category | Primary use | Typical triggers (natural language) | Alternates / fallbacks | Required binaries (full tier) |
|------|-----------|-------------|-------------------------------------|-------------------------|------------------------------|
| `search` | Content search | Default **regex** content search; gitignore-aware via rg | “grep”, “regex”, “pattern matching”, default text search | `ripgrep`, `concept_search` | `rg` |
| `ripgrep` | Content search | Multiline, hidden files, counts, rg-specific flags | “multiline”, “hidden”, “count mode”, advanced rg | `search`, `concept_search` | `rg` |
| `concept_search` | Content search | BM25 **conceptual / relevance-ranked** search | “authentication related”, “ideas around”, fuzzy topic search | `search`, `ripgrep` | `rg` |
| `find_files` | File discovery | List paths by glob/type/extension | “all `*.ts` under src”, enumerate files | `fuzzy_find` | `fd` |
| `fuzzy_find` | File discovery | Approximate **filename** matching | “might be called cfg”, approximate name | `find_files` | `fzf` |
| `semgrep` | Structural analysis | Security / policy / bug finding (SARIF-style JSON) | “Owasp”, “SAST”, “Semgrep audit” | `ast_grep`, `search` | `semgrep` |
| `ast_grep` | Structural analysis | AST patterns, metavar refactors | “ast-grep”, `$VAR`, metavar rewrite | `semgrep`, `search` | `ast-grep` |
| `count_lines` | Metrics | LOC / comments / blanks by language | “tokei”, “lines of code”, LOC stats | `find_files` (lightweight listing only) | `tokei` |
| `find_duplicates` | Metrics | Copy-paste / clone detection | “jscpd”, “duplicate code blocks” | `ast_grep` | `jscpd` |
| `read_enhanced` | Enhanced core | Skeleton reads, jq/yq slices, highlighting | “read_enhanced”, smart read, JSON field slice | `search` | optional: `ast-grep`, `jq`, `yq`, `bat` |
| `write_enhanced` | Enhanced core | Atomic / streaming writes, backups | atomic write, “write_enhanced”, large payloads | `shell_enhanced` | — (Bun-native) |
| `edit_enhanced` | Enhanced core | AST rewrite + preview + backups | syntax-aware edit, “edit_enhanced”, ast patch | `shell_enhanced` | `ast-grep` when using AST tier |
| `shell_enhanced` | Enhanced core | JSON-first shell (Nu → Bun → bash) | “shell_enhanced”, structured JSON from CLI | — | optional: `nu` |
| `ls_enhanced` | Enhanced core | Repo topology tree + metadata | “ls_enhanced”, topology, repo structure | `find_files` | optional: `br` / `broot` |

## Conflict resolution cheatsheet

| Tension | Prefer | When to switch |
|---------|--------|----------------|
| **`search` vs `concept_search`** | `search` if you have **regex** | `concept_search` when query is **topic / NL** without an exact pattern |
| **`search` vs `ripgrep`** | `search` by default | `ripgrep` for **multiline / hidden / counts** |
| **`find_files` vs `fuzzy_find`** | `find_files` for known patterns | `fuzzy_find` for **approximate** names |
| **`semgrep` vs `ast_grep`** | `semgrep` for **security lint / rules** | `ast_grep` for **grammar / metavar** structural edits |
| **Duplicate churn vs LOC** | `find_duplicates` for clones | `count_lines` for **volume metrics** |

## Builtin read/write/edit/shell/list vs enhanced

Routing **only** returns pi-sherlock tools. When the task is **tiny** or **offline** simplicity wins, builtins may suffice. Choose enhanced tools when prompts mention **large files**, **structure**, **JSON/YAML excerpts**, **AST safety**, **JSON CLI output**, or **repository topology**—those map to intents and features used by `ContextAnalyzer`.

## See also

- `README.md` — Smart routing section and requirement table  
- `docs/smart-routing.md` — merge weights, binary gating, registration filter  
