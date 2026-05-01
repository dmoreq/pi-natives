# pi-sherlock

High-performance file search, structural code analysis, and code counting for [pi coding agent](https://github.com/mariozechner/pi-coding-agent).


## Tools

### Content Search

| Tool | Engine | What it does |
|------|--------|-------------|
| **`search`** | ripgrep | DEFAULT content search — regex pattern matching in file contents |
| **`ripgrep`** | ripgrep | Advanced rg features: multiline, hidden files, count mode, fixed strings |
| **`concept_search`** | BM25 | Relevance-ranked conceptual search — natural language discovery |

### File & Path Search

| Tool | Engine | What it does |
|------|--------|-------------|
| **`fd`** | fd | File finding by name/extension/type — exact criteria |
| **`fzf`** | fzf | Fuzzy file path search — approximate filenames |

### Structural Code Analysis

| Tool | Engine | What it does |
|------|--------|-------------|
| **`semgrep`** | semgrep | Security audit, bug detection, linting rules — "is this code safe?" |
| **`ast_grep`** | ast-grep | Structural search & refactoring with metavariables — "find & rewrite this pattern" |

### Code Statistics

| Tool | Engine | What it does |
|------|--------|-------------|
| **`tokei`** | tokei | Code line counter — lines, comments, blanks by language |

## Trigger Decision Flow

```
"I know the exact regex"            → search          (DEFAULT content search)
"I have a concept/idea"             → concept_search
"I need security/linting analysis"  → semgrep
"I need structural search/refactor" → ast_grep
"I sort of know the filename"       → fzf
"I know the exact filename/ext"     → fd
"I need multiline/hidden/count"     → ripgrep         (advanced only)
"How many lines of code?"           → tokei
"Find duplicate code blocks"        → jscpd
```

## Requirements

- **Bun** >= 1.3
- **ripgrep** (`rg`) — `brew install ripgrep`
- **semgrep** — `brew install semgrep` or `pip install semgrep`
- **fzf** — `brew install fzf`
- **fd** — `brew install fd`
- **ast-grep** — `brew install ast-grep`
- **tokei** — `brew install tokei`
- **jscpd** — `npm i -g jscpd` or `brew install jscpd`

All tools are optional — missing binaries show a warning on session start.

## Installation

```bash
bun add pi-sherlock
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test
```

## License

MIT
