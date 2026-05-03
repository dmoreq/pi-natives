---
name: pi-sherlock-semgrep
description: AST-aware static analysis and pattern-based code search using Semgrep — find bugs, security issues, and code smells
---

# pi-sherlock-semgrep: AST-Aware Code Analysis

**Trigger:** You need to match CODE STRUCTURE (function calls, class definitions, control flow) that regex CANNOT reliably match.

This skill provides AST-aware code search and static analysis powered by [Semgrep](https://semgrep.dev/). Unlike regex, Semgrep understands language syntax.

## Tool

### `semgrep` — Code Structure Analysis

**The single rule:** If your pattern involves code structure (function calls, classes, control flow), use `semgrep`. If it's a simple text string, use `search`.

| Pattern | Tool | Why |
|---|---|---|
| `eval(...)` | **semgrep** | Function call — AST knows structure |
| `$X == $X` | **semgrep** | Self-comparison — AST tracks variables |
| `$F(...)` → `$F.new(...)` | **semgrep** | Method call pattern |
| `TODO` | `search` | Simple text string |
| `function\s+\w+` | `search` | Regex pattern for text |
| `authentication` | `concept_search` | Conceptual, not structural |

**Two modes:**

| Mode | Usage | Example |
|------|-------|---------|
| **Pattern** | `semgrep -pattern "eval(...)" -language ts` | Find all `eval()` calls |
| **Config** | `semgrep -config p/r2c-security-audit` | Run security audit rules |

**Key features:**
- Understands code structure (functions, classes, control flow)
- All major languages: TypeScript, Python, Java, Go, Rust, etc.
- Predefined rule packs for security, best practices, secrets
- Filter by severity: ERROR, WARNING, INFO

**Do NOT use for:**
- Simple text/string matching → use `search`
- Concept-based file discovery → use `concept_search`
- Filename search → use `fzf` or `fd`

## Guidelines

1. Always specify `language` when using a `pattern`
2. Use `config: "auto"` for quick scans, `"p/r2c-security-audit"` for security
3. Pair with `search` for deeper investigation of findings
4. Start broad (INFO) and narrow as needed

## Output Size Validation

All pi-sherlock tools automatically truncate outputs to 200 lines / 10,000 characters
before returning to the agent. A diagnostic note is appended when truncation occurs.
This ensures token limits are respected regardless of result size.
