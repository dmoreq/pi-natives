# pi-sherlock

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![pi-package](https://img.shields.io/badge/pi-package-blue)](https://pi.dev/packages)

High-performance file search, structural code analysis, and code counting extension for [pi](https://github.com/mariozechner/pi-coding-agent).

## Table of Contents

- [Installation](#installation)
- [Tools](#tools)
- [Quick Decision Flow](#quick-decision-flow)
- [Requirements](#requirements)
- [Usage](#usage)
- [Development](#development)
- [License](#license)

## Installation

```bash
pi install git:github.com/dmoreq/pi-sherlock
```

Update to latest:

```bash
pi update
```

Try without installing:

```bash
pi -e git:github.com/dmoreq/pi-sherlock
```

## Tools

### Content Search

| Tool | Engine | Description |
|------|--------|-------------|
| `search` | ripgrep | **Default content search.** Regex pattern matching across file contents. |
| `ripgrep` | ripgrep | Advanced features: multiline, hidden files, count mode, fixed strings. |
| `concept_search` | BM25 | Relevance-ranked conceptual search for natural language queries. |

### File & Path Search

| Tool | Engine | Description |
|------|--------|-------------|
| `fd` | fd | Find files by name, extension, or type with exact criteria. |
| `fzf` | fzf | Fuzzy file path search with approximate filename matching. |

### Structural Analysis

| Tool | Engine | Description |
|------|--------|-------------|
| `semgrep` | semgrep | Security audits, bug detection, and linting rules. |
| `ast_grep` | ast-grep | Structural search and refactoring with metavariables. |

### Code Metrics

| Tool | Engine | Description |
|------|--------|-------------|
| `tokei` | tokei | Count lines of code, comments, and blanks by language. |
| `jscpd` | jscpd | Detect duplicated and copy-pasted code blocks. |

## Quick Decision Flow

```
"I know the exact regex"           → search           (DEFAULT content search)
"I have a concept / idea"          → concept_search
"I need security / linting audit"  → semgrep
"I need structural search/refactor"→ ast_grep
"I sort of know the filename"      → fzf
"I know the exact filename / ext"  → fd
"I need multiline / hidden / count"→ ripgrep          (advanced features only)
"How many lines of code?"          → tokei
"Find duplicate code blocks"       → jscpd
```

## Requirements

External CLI tools are optional. Missing binaries show a warning on session start — only that tool is unavailable.

| Binary | Used by | Install |
|--------|---------|---------|
| `rg` (ripgrep) | `search`, `ripgrep` | `brew install ripgrep` |
| `semgrep` | `semgrep` | `brew install semgrep` or `pip install semgrep` |
| `fzf` | `fzf` | `brew install fzf` |
| `fd` | `fd` | `brew install fd` |
| `ast-grep` | `ast_grep` | `brew install ast-grep` |
| `tokei` | `tokei` | `brew install tokei` |
| `jscpd` | `jscpd` | `npm i -g jscpd` or `brew install jscpd` |

## Usage

After installation, restart pi. All 9 tools are registered automatically. Start a conversation and pi will route queries to the right tool based on context.

## Development

```bash
git clone git@github.com:dmoreq/pi-sherlock.git
cd pi-sherlock
bun install
bun test
```

## License

[MIT](LICENSE)
