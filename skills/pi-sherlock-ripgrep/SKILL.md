---
name: pi-sherlock-ripgrep
description: Advanced pattern-based file content search powered by ripgrep — multiline, count mode, fixed strings, and raw rg access
---

# pi-sherlock-ripgrep: Advanced File Content Search

**Trigger:** You need ripgrep features that `search` does NOT expose. Only use this when `search` is insufficient.

This skill provides advanced ripgrep access. Think of it as `search` with extra knobs — don't use it for basic searches.

## Tool

### `ripgrep` — Advanced Regex Search

**The single rule:** Use `search` for everything. Only use `ripgrep` when you specifically need one of these features that `search` doesn't have:

| You need to... | Use |
|---|---|
| Search across multiple lines | `ripgrep` with `multiline: true` |
| Get match counts per file | `ripgrep` with `mode: "count"` |
| List only filenames with matches | `ripgrep` with `mode: "filesWithMatches"` |
| Search hidden/dotfiles | `ripgrep` with `hidden: true` |
| Search gitignored files | `ripgrep` with `noIgnore: true` |
| Match literal strings (not regex) | `ripgrep` with `fixedStrings: true` |
| Set a timeout | `ripgrep` with `timeoutMs` |
| Anything else | **`search`** (DEFAULT) |

**Decision tree:**
```
Can you express your need with `search`?
  ├── YES → Use `search` (simpler API, same engine)
  └── NO (need multiline/count/hidden/no-ignore/fixed-strings/timeout)
        └── Use `ripgrep`
```

**Do NOT use for:**
- Standard content searches → use `search` (simpler)
- AST-aware code analysis → use `semgrep`
- File finding by name → use `fd` or `fzf`
- Conceptual search → use `concept_search`

## Guidelines

1. **Default to `search`** — `ripgrep` is the escape hatch
2. Use `mode: "count"` for match statistics without full output
3. Use `mode: "filesWithMatches"` to find which files contain a pattern
4. Use `multiline: true` with patterns like `<open>.*?</close>` for cross-line matching
5. Use `fixedStrings: true` when pattern contains special chars that should be literal

## Output Size Validation

All pi-sherlock tools automatically truncate outputs to 200 lines / 10,000 characters
before returning to the agent. A diagnostic note is appended when truncation occurs.
This ensures token limits are respected regardless of result size.
