---
name: pi-sherlock
description: High-performance file search and text operations — regex search via ripgrep and relevance-ranked BM25 search
---

# pi-sherlock: Fast File Search and Text Operations

This package provides two complementary content search tools.

## Trigger Decision

| Your intent | Use |
|---|---|
| "I know the exact regex pattern" | **`search`** |
| "I have a concept/idea and want relevant files" | **`concept_search`** |
| "I sort of know the filename" | `fuzzy_find` (fuzzy path) |
| "I know the filename or extension" | `find_files` (file listing) |
| "I need to match code structure (AST)" | `semgrep` |
| "I need multiline/count/hidden file search" | `ripgrep` (advanced) |

## Tools

### `search` — Regex File Search (ripgrep)

**Trigger:** You have a PRECISE regex pattern and need to search file CONTENTS.

This is your DEFAULT content search tool. It is faster, respects `.gitignore`, enforces limits, and returns structured output.

**Key features:**
- Full regex syntax (e.g., `log.*Error`, `function\\s+\\w+`)
- `.gitignore`-aware by default
- Glob and file-type filtering
- Context lines before/after matches
- Case-insensitive mode

**Do NOT use for:**
- Conceptual queries where you don't know exact terms → use `concept_search`
- Fuzzy filename search → use `fuzzy_find`
- File listing by name/extension → use `find_files`
- Matching code structure (AST) → use `semgrep`
- Advanced rg features (multiline, hidden, count) → use `ripgrep`

### `concept_search` — Relevance-Ranked Search (BM25)

**Trigger:** You have a CONCEPT or IDEA and want to find relevant files — you do NOT know the exact regex pattern.

Searches file content using BM25 relevance ranking. Returns matches ordered by semantic relevance.

**Key features:**
- Natural language or keyword queries
- BM25 scoring (standard IR ranking)
- Sorted by relevance (highest score first)

**Do NOT use for:**
- Exact regex matching → use `search`
- Filename/path search → use `fzf` or `fd`
- Code structure matching → use `semgrep`

## Guidelines

1. **Default to `search`** — it's the primary content search tool
2. Use `concept_search` only for open-ended conceptual discovery
3. NEVER shell out to `grep`/`rg`/`ag`/`ack` in Bash — use `search`
4. Combine tools: `search` for precision, `concept_search` for exploration

## Output Size Validation

All pi-sherlock tools apply automatic output truncation to prevent excessive
token consumption. The rule is:

- **200 lines max** — outputs beyond this are truncated to the first 200 lines
- **10,000 characters max** — outputs beyond this are truncated to 10K chars
- Both limits are applied independently (whichever is hit first)
- A diagnostic line is appended: `(truncated: showed N/M lines, X/Y chars)`
- Truncation happens **before** the output reaches the LLM, so the agent always
  sees manageable results

This applies to all tools: `search`, `concept_search`, `fuzzy_find`, `find_files`,
`semgrep`, `ripgrep`, `ast_grep`, `count_lines`, `find_duplicates`.
