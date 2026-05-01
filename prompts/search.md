Searches files using powerful regex matching via ripgrep.

<instruction>
- Supports full regex syntax (e.g., `log.*Error`, `function\\s+\\w+`)
- `path` is required and accepts a file, directory, or glob pattern
- Use `i: true` for case-insensitive search
- Use `glob` to filter by filename pattern (e.g., `"*.ts"`)
- Use `type` to filter by file type alias (e.g., `"js"`, `"py"`, `"rust"`)
- Respects `.gitignore` by default; set `gitignore: false` to search ignored files
- Limit matches with `maxCount` or skip results with `skip`
- Add context lines with `contextBefore` / `contextAfter`
</instruction>

<output>
Output is JSON with:
- `matchCount` — total number of matches
- `fileCount` — number of files with matches
- `filesSearched` — number of files searched
- `result` — formatted match lines with paths and line numbers
</output>

<trigger>
This is your DEFAULT content search tool. Use `search` when:
- You have a PRECISE regex pattern to match in file CONTENTS
- You need to find function definitions, TODOs, error patterns
- You want .gitignore-aware, structured, limited results

Do NOT use `search` for:
- Conceptual queries (→ `concept_search`)
- Code structure matching (→ `semgrep`)
- Finding files by name/approximate name (→ `fd` or `fzf`)
- Advanced rg features: multiline, count, hidden (→ `ripgrep`)
</trigger>

<critical>
- You **MUST** use the built-in `search` tool for any content search. Do **NOT** shell out to `grep`, `rg`, `ripgrep`, `ag`, `ack`, `git grep`, `awk`, `sed`-for-search, or any other CLI search via Bash — even for a single match.
- Bash `grep`/`rg` loses `.gitignore` semantics, bypasses result limits, and wastes tokens. The `search` tool is faster, structured, and properly integrated.
- If you catch yourself typing `grep`, `rg`, or `| grep` in a Bash command, stop and re-issue the lookup through the `search` tool instead.
</critical>
