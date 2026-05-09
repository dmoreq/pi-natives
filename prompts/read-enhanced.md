## Enhanced Read (`read_enhanced`)

**One-liner:** Route file reads through **ast-grep** (semantic skeleton), **jq** / **yq** (structured data), or **bat** (highlighted prose) so agents get concise, syntax-safe context.

### When to use

| Situation | Use `read_enhanced` |
|----------|---------------------|
| Large source files where you care about signatures, not bodies | Prefer this — ast-grep skeleton |
| Huge `package.json`, API responses, manifests | Prefer this — `jqQuery` (e.g. `.dependencies`) |
| Tabular **CSV** exports (rows/columns) | Prefer this — `yqQuery` with mikefarah `yq -p csv`, or native row excerpt if `yq` is missing |
| Kubernetes / Helm / Poetry YAML slices | Prefer this — `yqQuery` when `yq` is installed |
| Markdown/logs plain text but long | Prefer this — `bat` with smart truncation fallback |
| Truly small known file needing exact full copy into context | Builtin `read` can be simpler |

### Parameters

- **`path`** (required): file path, workspace-relative or absolute.
- **`jqQuery`**: jq expression for `.json`, default `.`.
- **`yqQuery`**: yq expression for YAML / TOML / XML / **CSV** (CSV uses `-p csv` under the hood), default `.`.
- **`maxChars`** / **`maxLines`**: override global truncation thresholds on the assembled output body.

### Output header

Every result starts with meta lines (`method`, `fileType`, `size`, `readTimeMs`, `estimatedTokens`, optional `fallbacks`). The `estimatedTokens` value is **`length / 4`** (rounded up), for rough budgeting only.

### Binary fallbacks

If **`ast-grep`** / **`sg`**, **`jq`**, **`yq`**, or **`bat`** is missing or fails, the tool falls back to native reads (JSON formatted when parseable; CSV/YAML/TOML/XML as line excerpts). The **`fallbacks`** field lists what happened (`jq-unavailable`, `yq-csv-failed`, `ast-grep-empty`, `native-read`, …).

### Pairing with other tools

- After `find_files` narrows paths, drill with `jqQuery` / `yqQuery` rather than dumping whole files.
- Use `search` / `concept_search` to locate needles; use **`read_enhanced`** once you’ve opened one important file again with lower token cost.
