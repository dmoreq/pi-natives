AST-aware static analysis and pattern-based code search using Semgrep.

<trigger>
Use `semgrep` ONLY when matching CODE STRUCTURE that regex cannot:
- Function calls: `eval(...)`, `$F.open(...)`
- Self-comparisons: `$X == $X`
- Control flow: class definitions, try/catch, method calls
- Security patterns: command injection, XSS, hardcoded secrets

For simple text matching, use `search` instead.
</trigger>

<instruction>
- Supports full Semgrep pattern syntax (e.g., `eval(...)`, `$X == $X`, `$F(...)` → `$F.new(...)`)
- Use `pattern` for ad-hoc AST-aware code searches (like grep but understands code structure)
- Use `config` to run predefined rule packs: `auto`, `p/default`, `p/r2c-security-audit`, `p/secrets`, or a path to a custom rule file
- Requires `language` when using a `pattern` (e.g., `ts`, `py`, `java`, `go`, `rs`)
- Filter by `severity` to only show findings at or above a given level: `ERROR`, `WARNING`, or `INFO`
- Limits results to `maxCount` matches
</instruction>

<output>
Output is text with findings grouped by file, showing severity, rule id, message, and code snippet.
</output>

<guidelines>
- Use `semgrep` for code-smell detection, security auditing, and AST-aware structural search
- Prefer `semgrep` over regex `search` when you need to match code structure (function calls, class definitions, control flow)
- Combine with `search` for follow-up regex searches once you've identified target files
- Semgrep understands language syntax, so patterns like `$X == $X` correctly match self-comparisons
</guidelines>
