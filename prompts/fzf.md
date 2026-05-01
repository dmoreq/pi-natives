Fuzzy file path search using fzf. Matches file names and paths based on fuzzy string matching — great for
finding files when you only remember part of their name or path.

<trigger>
Use `fuzzy_find` when you know APPROXIMATE file names but not exact paths.
"auth mid" → matches "src/auth/middleware.ts"
Results are file PATHS, not file contents.

Do NOT use for: searching contents (→ `search`), exact filenames (→ `find_files`).
</trigger>

<instruction>
- Uses fzf's fuzzy matching algorithm (not regex) — "auth mid" matches "src/auth/middleware.ts"
- Query terms can be in any order and don't need to be contiguous
- Supports glob filtering by file type with `glob` parameter
- Results are file paths, not file contents
- Empty query returns all files (up to the limit)
</instruction>

<output>
Output is a list of matched file paths, one per line, with a summary header.
</output>

<guidelines>
- Use `fuzzy_find` when you know approximate file names but not exact paths
- Prefer `fuzzy_find` over `search` (regex) for fuzzy/filename discovery
- Use `glob` to narrow results to specific file types
- Use `search` (ripgrep) when you need to search file contents
- Use `concept_search` for conceptual/relevance-based content search
</guidelines>
