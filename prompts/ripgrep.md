Raw ripgrep file content search with advanced options. A lower-level interface to ripgrep compared to the `search` tool.

<trigger>
ONLY use `ripgrep` when `search` is insufficient. Specifically, ONLY when you need:
- Multiline matching (`multiline: true`)
- Match counts per file (`mode: "count"`)
- Files-with-matches listing (`mode: "filesWithMatches"`)
- Hidden/dotfile search (`hidden: true`)
- Bypass .gitignore (`noIgnore: true`)
- Fixed strings (not regex) (`fixedStrings: true`)
- Timeout (`timeoutMs`)

For ALL standard content searches, use `search` — it's the same engine with a simpler API.
</trigger>

<instruction>
- Same regex engine as `search`, but exposes additional ripgrep-native options
- Supports multiline matching, count-only mode, and files-with-matches mode
- Control hidden files, .gitignore respect, fixed-string mode, and output truncation
- Full regex syntax (e.g., `log.*Error`, `function\\s+\\w+`)
- Use `mode: "count"` to get match counts without output, `mode: "filesWithMatches"` to list only file names
- Use `multiline: true` for patterns that span across lines
- Use `fixedStrings: true` to treat the pattern as a literal string (no regex)
- Use `hidden: true` to include dotfiles, `noIgnore: true` to ignore .gitignore
</instruction>

<output>
Output format depends on mode:
- "content": matched lines with file paths, line numbers, and context
- "count": file paths with match counts
- "filesWithMatches": one file path per matched file (no line content)
</output>

<guidelines>
- Use `ripgrep` (this tool) when you need advanced features: multiline, count mode, fixed strings, hidden files
- Use `search` for standard content searches with simpler parameters
- Use `semgrep` for AST-aware structural code analysis (beyond regex)
- Use `fd` for file *finding* by name/extension (not content search)
</guidelines>
