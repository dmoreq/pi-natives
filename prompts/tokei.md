Fast code line counter using tokei. Counts lines of code, comments,
and blanks by programming language.

<trigger>
Use `count_lines` when you need codebase STATISTICS:
"How many lines of code in this project?"
"What languages are used and how many lines each?"
"Show me code/comment/blank line breakdown."

tokei is NOT a search tool — it only COUNTS. For searching code content,
use `search`. For structural search, use `ast_grep`. For security analysis,
use `semgrep`.

Do NOT use for: searching code content (→ search or ast_grep),
file finding (→ fd/fzf), structural analysis (→ semgrep/ast_grep).
</trigger>

<instruction>
- Counts lines of code, comments, and blanks across 200+ languages
- Auto-detects language from file extension
- Respects .gitignore by default (use `noIgnore` to override)
- Use `files: true` for per-file breakdowns
- Use `types` to filter by specific languages (e.g., ["Rust", "TypeScript"])
- Use `exclude` to skip directories (e.g., ["node_modules", "dist"])
- Use `sort` to order output by "code", "files", "lines", "comments", or "blanks"
</instruction>

<output>
Output is a formatted table with columns: Language, Files, Lines, Code, Comments, Blanks.
</output>

<guidelines>
- Use `count_lines` for codebase statistics, not for searching or analyzing code
- Default path is the workspace root (.)
- Combine with other tools: count_lines to see project stats, then search/ast_grep to investigate
</guidelines>
