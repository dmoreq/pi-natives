---
name: pi-sherlock-ast-grep
description: Structural code search & refactoring via AST patterns using ast-grep — precise structural matching with metavariables and code rewriting
---

# pi-sherlock-ast-grep: Structural Search & Refactoring

**Trigger:** You need to find or transform CODE STRUCTURES with metavariable capture ($X, $$$ARGS). You want to UNDERSTAND or REWRITE code patterns.

ast-grep understands code as AST nodes, enabling precise structural matching. Unlike semgrep (security/linting), ast-grep is designed for search and automated refactoring.

## Tool

### `ast_grep` — Structural Code Search

**The single rule:** Use `ast_grep` for structural search/refactor. Use `semgrep` for security/linting analysis assignments.

| Intent | Tool | Why |
|---|---|---|
| Find all call sites of `eval()` and capture args | **ast_grep** | Structural search + metavariables |
| Refactor `oldMethod(a, b)` → `newMethod(a, b)` | **ast_grep** | Rewrite with `$$$ARGS` capture |
| Find all method calls on an object | **ast_grep** | `$O.method($$$ARGS)` |
| Check if code has security vulnerabilities | `semgrep` | Security rules, not structural search |
| Find simple text like "TODO" | `search` | Text matching, not AST |
| Search for a concept across the codebase | `concept_search` | Conceptual, not structural |

**Key distinction:**
```
ast_grep → "Find this pattern so I can understand or rewrite it"
semgrep  → "Does this code have bugs or security issues?"
```

**Key features:**
- Pattern syntax: `$X` (single node), `$$$X` (multi-node/rest)
- Code rewriting: `-r "replacement($$$ARGS)"`
- 6 strictness levels: `smart` (default), `ast`, `relaxed`, `cst`, `signature`, `template`
- All major languages: TypeScript, Python, Rust, Go, Java, etc.

**Do NOT use for:**
- Security vulnerability detection → use `semgrep`
- Simple text search → use `search`
- Conceptual search → use `concept_search`
- Filename search → use `fzf` or `fd`
- Code statistics → use `tokei`

## Guidelines

1. Always specify `language` for accurate AST parsing
2. Use `$$$ARGS` to capture function arguments, `$X` for single-node match
3. Combine with `search` for follow-up text investigation
4. Use `rewrite` carefully — it modifies matched code in-place
