---
name: pi-sherlock-fzf
description: Fuzzy file path search powered by fzf — find files when you only remember part of their name
---

# pi-sherlock-fzf: Fuzzy File Path Search

**Trigger:** You sort-of know the file name but not the exact path. Query terms can be in any order and don't need to be contiguous.

This skill provides fuzzy file PATH searching (NOT content search) powered by [fzf](https://github.com/junegunn/fzf).

## Tool

### `fzf` — Fuzzy Path Search

**The single rule:** Use `fzf` when you have APPROXIMATE file names and need fuzzy matching. Use `fd` when you know the exact name/extension. Use `search` for file CONTENTS.

| Intent | Tool |
|---|---|
| "I think there's a file called auth... something" | **`fzf`** |
| "Find all .ts files in src/" | `fd` |
| "Search for 'TODO' in file contents" | `search` |
| "Find files about authentication" | `concept_search` |

**Key features:**
- Fuzzy matching: `"auth mid"` matches `"src/auth/middleware.ts"`
- Query terms in any order, don't need contiguous
- Glob filtering for file types
- Results are file PATHS (not contents)

**Do NOT use for:**
- Searching file CONTENTS → use `search`
- Exact filename/extension matching → use `fd`
- Conceptual/relevance search → use `concept_search`
- Code structure matching → use `semgrep`

## Guidelines

1. Query terms are fuzzy-matched against the FULL relative path
2. Use `path` to narrow search to a subdirectory
3. Combine `glob` with path filtering for targeted discovery
4. Pair with `search`: fzf to find the file, search to grep its contents

## Output Size Validation

All pi-sherlock tools automatically truncate outputs to 200 lines / 10,000 characters
before returning to the agent. A diagnostic note is appended when truncation occurs.
This ensures token limits are respected regardless of result size.
