---
name: pi-sherlock-edit-enhanced
description: AST-aware file editing via ast-grep rewrites with preview mode and automatic backups — for structural refactors, not verbatim text patches
---

# pi-sherlock-edit-enhanced: AST-Aware File Editing

**Trigger:** You need to edit code using STRUCTURAL patterns (metavariables), want a PREVIEW before touching disk, or need automatic BACKUP snapshots. For small verbatim text patches, use builtin `edit`.

## Tool Selection

```
Structural rewrite with $X/$$$ARGS?  → edit_enhanced  ← YOU ARE HERE
Want preview diff before writing?    → edit_enhanced  (preview: true)
Need backup before risky change?     → edit_enhanced  (backup: true)
Simple exact text replacement?       → builtin edit
Full file rewrite?                   → write_enhanced
```

## Routing Logic (internal)

```
File is source code + ast-grep available?
  ├── YES → ast-grep rewrite (-p pattern -r replacement)
  │          Metavariables: $X (single node), $$$ARGS (rest/spread)
  │          Strictness: generic→smart, function|class|method→ast
  └── NO  → Native literal substring replace
             (Markdown, unknown extensions, or missing ast-grep binary)
```

## Parameters

| Parameter | Effect | Default |
|-----------|--------|---------|
| `path` | File to edit (required) | — |
| `pattern` | AST pattern or literal string | — |
| `replacement` | Rewrite template or literal replacement | — |
| `preview` | Dry-run: show diff, don't write | `false` |
| `backup` | Save `.bak.{timestamp}` before editing | `true` |
| `nodeType` | Strictness hint: `generic`, `function`, `class`, `method`, `variable` | — |
| `scope` | `file` (entire file), `function`, `class` (reserved, currently whole-file) | `file` |

## Workflow: Always Preview First

```
1. edit_enhanced  preview: true   → see what would change
2. edit_enhanced  (no preview)    → apply if preview looks correct
3. verify with read_enhanced or search
4. rollback: copy from reported backup path if needed
```

## Usage Patterns

```
# Rename a function call across a file
pattern: "oldHelper($$$ARGS)"
replacement: "newHelper($$$ARGS)"
language: ts  (via nodeType: "function")

# Rename a variable (structural, not text)
pattern: "const $X = require($$$M)"
replacement: "import $X from $$$M"

# Preview a risky refactor first
pattern: "fetchData($$$ARGS)"
replacement: "fetchDataV2($$$ARGS)"
preview: true   ← see diff without writing

# Literal replacement (fallback mode for non-code)
pattern: "v1.0.0"
replacement: "v2.0.0"
path: "README.md"
```

## Failure Modes

| Failure | Meaning | Action |
|---------|---------|--------|
| `AstEditError: missing binary` | ast-grep not installed | Literal fallback used (metavariables won't match) |
| `AstEditError: invalid pattern` | Pattern syntax error | Fix pattern before disk is touched |
| `totalChanges: 0` | Pattern matched nothing | Verify pattern with `ast_grep` tool first |
| `syntax_ok: false` | Rewrite broke syntax | Check rewrite; ast-grep guarantees structure but not types |

## Backup & Rollback

- Backup written to `{path}.bak.{timestamp}` before every edit (when `backup: true`).
- To rollback: copy backup file back over the original.
- `preview: true` never creates backups (read-only diff).

## Guidelines

1. **Always `preview: true` first** on structural rewrites — see the diff before touching disk.
2. Keep `backup: true` (default) during refactoring sessions.
3. Use `ast_grep` tool first to confirm pattern matches before using `edit_enhanced` to apply.
4. For verbatim small patches (you have the exact text), prefer builtin `edit` — simpler and faster.
5. `nodeType: "generic"` → smart strictness (ignores whitespace/comments); `"function"` / `"class"` → strict AST matching.
6. `scope: "function"` / `"class"` are schema-stable but still traverse the whole file — use narrower patterns instead.

## Do NOT use for

- Simple exact text replacement → builtin `edit`
- Full file replacement → `write_enhanced`
- Reading structure → `read_enhanced`
- Finding pattern locations → `ast_grep` tool (search only, no edit)
