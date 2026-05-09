## Enhanced Write (`write_enhanced`)

Bun-backed file writes: **direct `Bun.write`**, **atomic temp + rename**, optional **streaming** of large payloads into the temp file, **append** (`mode: "append"`; non-atomic uses read-merge + `Bun.write`), and optional **backup** snapshots before overwriting.

### When to use `write_enhanced` vs builtin `write`

| Situation | Tool |
|-----------|------|
| Need readers to see consistent full-file snapshots (crash-safe replace) | `write_enhanced` (`atomic`, default `true` for `mode: "write"`) |
| Risky refactor; want a reversible `.bak` copy | `write_enhanced` with `backup: true` |
| Very large string payload; want chunked write to temp before rename | `write_enhanced` with `streaming: true` |
| Simple small edit, no atomicity concern | builtin `write` |
| Log-style sequential append (`Bun.write` after read-merge; not kernel `O_APPEND`) | `write_enhanced` with `mode: "append"`, `atomic: false` |
| Append but treat whole file update atomically (read → merge → rename) | `mode: "append"`, `atomic: true` |

### Parameters (summary)

- **`path`** — absolute or workspace-relative file path.
- **`content`** — UTF-8 text to write or append.
- **`mode`** — `"write"` (default) or `"append"`.
- **`atomic`** — temp file + `rename` for replace; for append, `true` means read-merge-write + atomic replace (slower for huge files).
- **`backup`** — copy existing target to `{path}.bak.{timestamp}` before overwrite.
- **`streaming`** — for atomic writes whose payload crosses an internal threshold, stream chunks via Bun native `File.writer` into the temp file.

### Output

Returns bytes written, elapsed ms (`writeTime`), method (`bun-direct` | `bun-atomic` | `bun-append`), `atomic` flag, optional `backup` path.

Non-atomic append (`mode: "append"`, `atomic: false`): reads existing bytes (if any), merges new content in memory, and writes via `Bun.write` (not POSIX `O_APPEND`; use atomic append when you need a temp+rename swap).

### Pairing

Use after **`read_enhanced`** when you rewrote structured content locally and need an atomic swap back to disk — especially manifests, generated sources, or large markdown/docs.
