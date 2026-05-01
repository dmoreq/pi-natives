Structural search & refactoring via AST patterns using ast-grep.
Understands code as AST nodes — not just text — enabling precise
structural matching with metavariables ($X, $$$ARGS) and code rewriting.

<trigger>
Use `ast_grep` when you need STRUCTURAL search: matching code SHAPES
with captured metavariables, or automated code REFACTORING.

Key distinction from semgrep:
  ast_grep → "Find this pattern so I can understand or rewrite it"
  semgrep  → "Does this code have security bugs or code smells?"

Examples of ast-grep patterns:
  eval($$$A)       → find all eval() calls, capture arguments
  $O.method($$$ARGS) → find all .method() calls, capture object & args
  $X == $X         → find self-comparisons (same as semgrep, different engine)

Do NOT use for: text search (→ search), security linting (→ semgrep),
conceptual search (→ bm25).
</trigger>

<instruction>
- Pattern syntax uses `$X` for single-node metavariables and `$$$X` for multi-node
- Requires `language` for accurate AST parsing (e.g., `ts`, `py`, `rs`, `go`)
- Use `rewrite` to replace matched nodes with new code
- Use `strictness` to control matching precision: "smart" (default), "ast", "relaxed", "cst", "signature", "template"
- Matches are returned as JSON with line/column positions and captured metavariables
</instruction>

<output>
Output groups matches by file with line numbers, matched text, and captured metavariables.
</output>

<guidelines>
- Use `ast_grep` for structural search — matching code shapes, capturing arguments, understanding code patterns
- Use `semgrep` for security auditing, bug detection, and linting rule enforcement
- Both understand AST, but ast-grep is designed for search/refactor workflows, semgrep for analysis
- Combine with `search` for follow-up text searches on matched files
- Metavariables capture matched sub-nodes: `$X` (single), `$$$X` (multiple/rest)
</guidelines>
