---
name: pi-sherlock-fd
description: Fast file and directory finding powered by fd — a modern alternative to the system `find` command
---

# pi-sherlock-fd: Fast File Finding

**Trigger:** You know the EXACT filename, extension, or file type you're looking for. Use for "list all .ts files" or "find files named config".

This skill provides fast file and directory discovery powered by [fd](https://github.com/sharkdp/fd). `fd` is a parallelized, user-friendly `find` alternative.

## Tool

### `fd` — Fast File/Directory Listing

**The single rule:** Use `fd` when you know WHAT files you want (by name, extension, or type). Use `fzf` when you only APPROXIMATELY know. Use `search` for file CONTENTS.

| Intent | Tool |
|---|---|
| "List all .ts files in src/" | **`fd`** |
| "Find files named config" | **`fd`** |
| "I think it was called auth... mid... something" | `fzf` |
| "Search for 'TODO' in file contents" | `search` |

**Key features:**
- Regex, glob, or extension-based filename matching
- File/directory/symlink type filtering
- `.gitignore`-aware by default
- Case-insensitive by default
- Much faster than `find`

**Do NOT use for:**
- Searching file CONTENTS → use `search` or `ripgrep`
- Fuzzy filename matching → use `fzf`
- Conceptual/content search → use `concept_search`
- Code structure search → use `semgrep`

## Guidelines

1. Empty `pattern` lists ALL files — great for project exploration
2. Use `extension` for fast type filtering, `glob` for complex patterns
3. Pair with `search`: fd → find, search → grep contents
4. Use `hidden` sparingly — `.gitignore` is usually correct

## Output Size Validation

All pi-sherlock tools automatically truncate outputs to 200 lines / 10,000 characters
before returning to the agent. A diagnostic note is appended when truncation occurs.
This ensures token limits are respected regardless of result size.
