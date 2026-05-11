---
name: pi-sherlock-concept-search
description: Relevance-ranked file content search using BM25 — use when you have a concept or idea but no exact regex pattern
---

# pi-sherlock-concept-search: Relevance-Ranked Search

**Trigger:** You have a CONCEPT or IDEA but don't know the exact terms, identifiers, or regex pattern. Natural-language discovery across file contents.

## Tool Selection

```
Natural language / concept?       → concept_search  ← YOU ARE HERE
Exact regex you can write?        → search           (DEFAULT for precise patterns)
Approximate filename?             → fuzzy_find
Code structure / AST patterns?    → semgrep or ast_grep
```

## How BM25 Works

BM25 (Best Match 25) is a probabilistic relevance ranking algorithm — the same model behind search engines. It scores files by how well they match the query, weighting term frequency against document length.

- **Input:** natural-language query or keyword bag
- **Output:** files ranked by relevance score + snippet
- **Not regex** — for exact patterns use `search`

## Feature Reference

| Parameter | Effect | Example |
|-----------|--------|---------|
| `query` | Natural language or keywords | `"rate limiting middleware"` |
| `paths` | Files or dirs to index (default: cwd) | `["src/", "lib/"]` |
| `limit` | Max results returned (default: 10) | `5` |

## Usage Patterns

```
# Find where authentication is handled
query: "authentication login session token"

# Find database connection setup
query: "database connection pool config"

# Find error handling for a specific concern
query: "rate limit exceeded retry backoff"

# Scope to a subdirectory
query: "image resize thumbnail"  paths: ["src/media/"]

# Find where a concept is tested
query: "unit test mock authentication"  paths: ["tests/"]
```

## Guidelines

1. Use **keyword bags** not sentences: `"auth token refresh"` beats `"where does the code refresh auth tokens"`.
2. **Narrow with `paths`** on large repos — indexing everything is slow.
3. Results are **ranked, not exhaustive** — a file with score 0.1 still matched, just weakly.
4. After finding relevant files, switch to `search` for exact pattern matching inside them.
5. Works best on **text / source files** — binary files are skipped automatically.
6. `limit: 3-5` is usually enough; increase only when you need broader coverage.

## Workflow

```
1. concept_search  →  "authentication session"         # find relevant files
2. search          →  "verifyToken|refreshToken"        # exact pattern inside those files
3. read_enhanced   →  open the most relevant file       # understand context
4. ast_grep        →  structural pattern if needed      # find call sites
```

## Do NOT use for

- Exact regex or literal string → `search`
- Filename / path discovery → `fuzzy_find` or `find_files`
- AST code structure → `semgrep` or `ast_grep`
- Advanced ripgrep features → `ripgrep`

## Output

Files with matches, sorted by BM25 score (descending), with a relevant snippet per file. Truncated to **200 lines / 10 000 chars**. Use `limit` to control result count.
