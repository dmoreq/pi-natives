---
name: pi-sherlock-jscpd
description: Copy/paste detection using jscpd — find duplicated and redundant code blocks for refactoring
---

# pi-sherlock-jscpd: Duplicate Code Detection

**Trigger:** Find DUPLICATED or COPY-PASTED code blocks. "Is there redundant code?" "What should I DRY up?" "Are these two modules doing the same thing?"

## Tool Selection

```
Find duplicated code blocks?       → find_duplicates  (jscpd)
Plan the refactoring pattern?      → ast_grep         (structural match + rewrite)
Find all occurrences of a fragment?→ search           (ripgrep)
Security / quality issues?         → semgrep
How many lines of code?            → count_lines      (tokei)
```

## Detection Modes

| Mode | What it finds | Use when |
|------|---------------|----------|
| `strict` | Identical code (exact clones) | Default — start here |
| `mild` | Near-duplicates with renamed variables | You suspect similar but not identical code |
| `weak` | Loosely similar structure | Exploratory, many false positives |

## Feature Reference

| Parameter | Effect | Example |
|-----------|--------|---------|
| `paths` | Directories to scan | `["src/", "lib/"]` |
| `mode` | Detection mode | `"strict"` \| `"mild"` \| `"weak"` |
| `minLines` | Minimum clone size (lines) | `5` (default), try `3` for small snippets |
| `minTokens` | Minimum clone size (tokens) | `50` (default) |
| `ignore` | Glob patterns to exclude | `["**/*.test.ts", "**/node_modules/**"]` |
| `format` | Filter by language | `["typescript", "python"]` |

## Refactoring Workflow

```
1. find_duplicates  → identify duplicate blocks (file paths + line ranges)
2. read_enhanced    → read both blocks to understand structure
3. ast_grep         → define the structural pattern to refactor
4. search           → find ALL call sites / occurrences
5. edit_enhanced    → apply the refactor (ast-grep rewrite or literal)
6. count_lines      → verify reduction (optional sanity check)
```

## Guidelines

1. **Start with `strict`** mode — exact clones first, expand to `mild` if needed.
2. **Always `ignore` test and generated files** — they have legitimate duplication:
   ```
   ignore: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**", "**/dist/**"]
   ```
3. Lower `minLines` to `3` for small utility functions; keep at `5` for noise reduction.
4. Use `format` to focus on one language at a time in mixed-language repos.
5. After finding duplicates, open both blocks with `read_enhanced` before refactoring.
6. jscpd reports each clone as a PAIR — both files + line ranges.

## Do NOT use for

- Text search → `search`
- Structural pattern matching → `ast_grep`
- Security analysis → `semgrep`
- Code statistics / line counts → `count_lines`

## Output

Each clone pair shows file paths, line ranges, and the duplicated code snippet. Outputs truncated to **200 lines / 10 000 chars**. Use `minLines` / `minTokens` to reduce noise, or `format` to narrow to one language.
