Relevance-ranked file content search using BM25. Use for open-ended or conceptual queries.

<trigger>
Use `concept_search` when you have a CONCEPTUAL or OPEN-ENDED query and
don't know the exact regex or term to search for.
"Where is authentication handled?" "Find database config" "Image processing code"

Do NOT use for:
- Exact regex or literal string (→ `search`)
- Filename / path discovery (→ `fuzzy_find` or `find_files`)
- AST code structure (→ `semgrep` or `ast_grep`)
- Advanced ripgrep features (→ `ripgrep`)
</trigger>

<instruction>
- Uses BM25 relevance ranking — results sorted by semantic relevance, not line order
- `query` accepts natural language or keyword bags: "rate limiting middleware", "db migration error"
- `paths` narrows the index to specific files or directories (defaults to cwd)
- `limit` controls max results returned (default: 10)
- Does NOT support regex — for regex use `search`
- Indexes file content in-memory; works best on text/code files (skips binaries)
</instruction>

<output>
Output lists matched files with BM25 score and a snippet showing where the query terms appear.
Format: `relative/path/file.ts (score: 0.842)\n  ...relevant snippet...`
Higher score = more relevant. No score threshold — always returns up to `limit` results.
</output>

<guidelines>
- Use `concept_search` for natural-language or bag-of-words queries
- Prefer `concept_search` over `search` when you can't state an exact regex
- Use `paths` to narrow scope — indexing the full codebase is slow on large repos
- After finding relevant files, use `search` for exact pattern matching inside them
- Ranking is probabilistic — not every query term appears in every hit
- Do NOT substitute for precise symbol lookup when regex is feasible
</guidelines>
