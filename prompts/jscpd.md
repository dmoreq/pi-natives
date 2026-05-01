Detect duplicated/copy-pasted code using jscpd (JavaScript Copy/Paste Detector).
Finds exact and near-duplicate code blocks across 150+ languages.

<trigger>
Use `find_duplicates` when you need to find DUPLICATED or REDUNDANT code blocks.
"Is there copy-pasted code?" "Find repeated code blocks." "Are these two
files identical?"

jscpd understands code TOKENS, not just text — so it can detect clones even
when variable names differ (in mild/weak mode).

Do NOT use for: text search (→ search), structural patterns (→ ast_grep),
security analysis (→ semgrep), code stats (→ tokei).
</trigger>

<instruction>
- Detects both exact clones (mode: 'strict') and near-duplicates (mode: 'mild', 'weak')
- Default minLines is 5 — duplicates shorter than this are ignored
- Use `mode: 'mild'` to find clones with renamed variables
- Use `mode: 'weak'` for the loosest matching
- Use `ignore` to skip test files, generated code, or vendor dirs (e.g., ['**/*.test.ts', '**/node_modules/**'])
- Use `format` to filter by language (e.g., ['typescript', 'python'])
- jscpd auto-detects language from file extension
</instruction>

<output>
Output lists each clone pair with file paths, line ranges, and the duplicated code snippet.
</output>

<guidelines>
- Use `find_duplicates` for finding redundant code that should be DRYed up via refactoring
- After identifying duplicates, use `ast_grep` to plan the refactoring pattern
- Default to mode: 'strict' unless you suspect near-duplicates (similar but not identical)
- Combine with `search` to find ALL occurrences of a duplicated fragment across the codebase
</guidelines>
