---
name: pi-sherlock-fd
description: Fast file and directory finding powered by fd — a modern alternative to the system `find` command
---

# pi-sherlock-fd: Fast File Finding

**Trigger:** You know the EXACT filename, extension, or file type you're looking for. Use for "list all `.ts` files" or "find files named `config`".

## Tool Selection

```
Exact name / extension / glob?  → find_files  (fd)
Approximate / fuzzy filename?   → fuzzy_find  (fzf)
File CONTENTS?                  → search      (ripgrep)
Conceptual / topical?           → concept_search
```

## Feature Reference

| Intent | Parameters |
|--------|-----------|
| All TypeScript files | `extension: "ts"` |
| Files matching a name pattern | `pattern: "config"` |
| Glob patterns | `glob: "*.test.ts"` |
| Directories only | `type: "directory"` |
| Symlinks only | `type: "symlink"` |
| Include hidden dotfiles | `hidden: true` |
| Include gitignored files | `noIgnore: true` |
| Case-sensitive match | `caseSensitive: true` |
| All files (inventory) | empty pattern |
| Max results | `maxResults: 100` |

## fd 10 Highlights

- **Smart case** — case-insensitive by default; auto-switches to case-sensitive if pattern contains uppercase. Override with `caseSensitive: true`.
- **`--and <pattern>`** — require multiple patterns to ALL match (exposed via `shell_enhanced`):
  ```bash
  fd --and "test" --and "auth" src/   # files matching both "test" AND "auth"
  ```
- **`--fixed-strings` / `-F`** — treat pattern as literal string (no regex). Use via `shell_enhanced` when pattern contains special regex chars.
- **`--no-require-git`** — respect gitignore rules even outside a git repo.
- **`--list-details` / `-l`** — `ls -l` style output with size, perms, date. Use via `shell_enhanced`.
- **`--exec` / `--exec-batch`** — run a command on each result. Use via `shell_enhanced`.
- **`--max-depth` / `--min-depth`** — control recursion depth.

## Guidelines

1. Empty `pattern` lists ALL files — great for project inventory before narrowing.
2. Prefer `extension` over `glob` for simple type filters (faster).
3. Use `hidden: true` sparingly — `.gitignore` is usually the correct filter.
4. Pair with `search`: `find_files` → narrow file set → `search` for contents.
5. For complex multi-condition finds, use `shell_enhanced` with raw `fd` flags (`--and`, `--exec`).
6. fd respects `.gitignore`, `.ignore`, and `.fdignore` by default.

## Do NOT use for

- Searching file CONTENTS → `search` or `ripgrep`
- Fuzzy filename matching → `fuzzy_find`
- Conceptual / relevance-ranked search → `concept_search`
- Code structure search → `semgrep` or `ast_grep`

## Output

Results are file/directory paths, one per line. Truncated to **200 lines / 10 000 chars**. Increase `maxResults` or narrow with `extension`/`glob` if results are cut off.
