---
name: pi-sherlock-tokei
description: Fast code line counter using tokei — count lines of code, comments, and blanks by programming language
---

# pi-sherlock-tokei: Code Line Counter

**Trigger:** You need codebase STATISTICS — line counts, language breakdowns, comment-to-code ratios.

tokei counts lines of code, comments, and blanks across 200+ languages. Think of it as `cloc` but faster and .gitignore-aware.

## Tool

### `tokei` — Code Statistics

**The single rule:** `tokei` COUNTS code. It does NOT search, analyze, or find code. For those tasks, use the other tools.

| Intent | Tool |
|---|---|
| "How many lines of code in this project?" | **tokei** |
| "What languages are used here?" | **tokei** |
| "Show per-file line counts" | **tokei** (`files: true`) |
| "Search for a function definition" | `search` |
| "Find structural patterns" | `ast_grep` |
| "Check for security issues" | `semgrep` |

**Key features:**
- Auto-detects 200+ languages by file extension
- Respects `.gitignore` by default
- Per-file breakdowns with `files: true`
- Filter by language with `types`
- Sort by any column: code, files, lines, comments, blanks
- Exclude directories with `exclude`

**Do NOT use for:**
- Searching code content → use `search`
- Structural code search → use `ast_grep`
- Security/linting analysis → use `semgrep`
- Finding files → use `fd` or `fzf`
- Conceptual discovery → use `concept_search`

## Guidelines

1. Defaults to workspace root — use `paths` to narrow scope
2. Combine with `search` or `ast_grep` after identifying large files
3. Use `exclude` to skip build artifacts (`node_modules`, `dist`, `target`)
4. Use `sort: "code"` to find the meatiest languages

## Output Size Validation

All pi-sherlock tools automatically truncate outputs to 200 lines / 10,000 characters
before returning to the agent. A diagnostic note is appended when truncation occurs.
This ensures token limits are respected regardless of result size.
