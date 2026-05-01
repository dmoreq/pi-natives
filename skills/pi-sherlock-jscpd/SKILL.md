---
name: pi-sherlock-jscpd
description: Copy/paste detection using jscpd — find duplicated and redundant code blocks for refactoring
---

# pi-sherlock-jscpd: Duplicate Code Detection

**Trigger:** You need to find DUPLICATED or COPY-PASTED code blocks. "Is there redundant code?" "Find repeated blocks." "What should I DRY up?"

jscpd detects both exact and near-duplicate code blocks across 150+ languages. It understands code as tokens, so it can find clones even with renamed variables.

## Tool

### `jscpd` — Duplicate Code Detection

**The single rule:** `jscpd` FINDS cloned code. Use `ast_grep` to PLAN the refactoring, and `search` to FIND all occurrences.

| Intent | Tool |
|---|---|
| "Find duplicated code blocks" | **jscpd** |
| "Plan how to refactor this duplicate" | `ast_grep` (structural pattern matching) |
| "Find all occurrences of this duplicated fragment" | `search` (text search) |
| "Check if this has security issues" | `semgrep` |
| "How many lines of code?" | `tokei` |

**Detection modes:**

| Mode | What it finds |
|---|---|
| `strict` | Exact clones (identical code) |
| `mild` | Near-duplicates (renamed variables, minor changes) |
| `weak` | Loose clones (similar structure, different names) |

**Key features:**
- 150+ languages auto-detected by file extension
- Configurable minimum clone size (`minLines`, `minTokens`)
- Exclusion patterns (`ignore`) for test files, generated code
- Language filtering (`format`) to focus on specific languages

**Workflow for handling duplicates:**
```
1. jscpd → find duplicate blocks
2. ast_grep → identify the structural pattern to refactor
3. search → find all call sites of the duplicated code
4. Implement your refactoring
```

**Do NOT use for:**
- Text search → use `search`
- Structural pattern matching → use `ast_grep`
- Security analysis → use `semgrep`
- Code statistics → use `tokei`

## Guidelines

1. Start with `mode: 'strict'` to find exact clones first
2. Use `mode: 'mild'` when you suspect similar-but-not-identical code
3. Use `ignore` to exclude tests, generated code, and vendor dirs
4. Default `minLines: 5` — lower it (e.g., 3) for smaller snippets
5. After finding duplicates, use `ast_grep` + `search` to plan and execute refactoring
