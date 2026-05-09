# Enhanced Edit (`edit_enhanced`)

Structural file edits routed through **ast-grep** rewrites whenever the target looks like source code (`FileTypeDetector` from read routing) **and** `sg`/`ast-grep` is installed. Markdown, unknown extensions, literal-only fixes, or missing binaries automatically fall back to **safe substring replace** powered by Bun I/O primitives.

## When this beats builtin `edit`

- You need metavariable-aware refactors (`$X`, `$$$ARGS`) rather than patching raw text blindly.
- You want **`preview`** to print the ast-grep diff before touching disk (`-U` is never used during preview-only runs).
- You want **crash-safe swaps** (`BunFileWriter` temp + rename + optional backups) after rewrites finalize.

Stick with **`edit`** for tiny verbatim hunks where you already have the unified diff.

## Workflow

1. Start with **`preview: true`** to confirm pattern coverage.
2. Re-run without preview (or omit `preview`, default false) once confident.
3. Leave **`backup: true`** (default) unless you explicitly accept overwriting without rollback snapshots.
4. Inspect `syntax_ok`; TypeScript/JavaScript uses `bun build --no-bundle`, Python leverages `python3 -m py_compile`, other languages are best-effort true.

### Parameters cheatsheet

- **`pattern`** / **`replacement`**: Passed straight to ast-grep `-p`/`-r` for code paths. For fallback mode they are literal strings (`String.prototype.split/join`, not regex).
- **`nodeType`**: Adjusts ast-grep `--strictness` (`generic` → smart, `function|class|method` → ast; `variable` leaves default strictness because `relaxed` often misses real TS declarators). Always pass a concrete `-p` pattern.
- **`scope`**:
  - **`file`** (default when omitted) — run the AST pattern across the entire file (**only mode with special behavior today**).
  - **`function`** / **`class`** — **RESERVED.** Accepted for schema stability, but edits still traverse the entire file identical to `file`. The tool response includes **`warnings`** so agents know scoped narrowing has not landed yet — express intent via narrower `pattern`s instead until relational rules arrive.

## Failure modes

- Missing binary → automatic native path (metavariable patterns will not match).
- Invalid / missing `pattern` → `AstEditError` before touching disk.
- `ast-grep` hard failures → `AstEditError` (spawn errors, `stderr` lines starting with `ERROR:`, non‑zero apply exit, or malformed `--json=compact` payloads). Benign `Warning:` lines are ignored.
- Zero ast-grep matches → file stays untouched, `totalChanges: 0`.
- Syntax validation false → double-check the rewrite; ast-grep guarantees structure but not project-level types.

For manual rollback, copy from the reported `backup` path or call `AstFileEditor.restore(backupPath, targetPath)` from automation code.
