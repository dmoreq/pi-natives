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

## Installation

```bash
pi install git:github.com/dmoreq/pi-sherlock
```

To update to the latest version:

```bash
pi update
```

To try without installing permanently:

```bash
pi -e git:github.com/dmoreq/pi-sherlock
```

## Requirements

The following CLI tools are used by the extension. Missing tools show a warning on session start but do not block usage — only that tool's functionality is unavailable.

| Tool | Required by | Install |
|------|-------------|---------|
| **ripgrep** (`rg`) | `search`, `ripgrep` | `brew install ripgrep` |
| **semgrep** | `semgrep` | `brew install semgrep` or `pip install semgrep` |
| **fzf** | `fzf` | `brew install fzf` |
| **fd** | `fd` | `brew install fd` |
| **ast-grep** | `ast_grep` | `brew install ast-grep` |
| **tokei** | `tokei` | `brew install tokei` |
| **jscpd** | `jscpd` | `npm i -g jscpd` or `brew install jscpd` |

> **Note:** All external tools are optional. The extension loads and registers all tools on startup; tools whose binaries are missing will error at invocation with a clear message.

## Usage

After installation, restart pi. The extension registers 9 tools automatically:

- **`search`** — your default content search with regex (ripgrep)
- **`concept_search`** — relevance-ranked conceptual search (BM25)
- **`semgrep`** — security audits and linting rules
- **`ast_grep`** — structural search and refactoring with metavariables
- **`fzf`** — fuzzy file path search
- **`fd`** — file finding by name, extension, or type
- **`ripgrep`** — advanced regex features (multiline, hidden files, count)
- **`tokei`** — code line counter
- **`jscpd`** — duplicate code detection

## Development

```bash
git clone git@github.com:dmoreq/pi-sherlock.git
cd pi-sherlock
bun install
bun test
```

## License

MIT
