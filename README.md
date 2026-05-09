# pi-sherlock

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![pi-package](https://img.shields.io/badge/pi-package-blue)](https://pi.dev/packages)

High-performance file search, structural code analysis, code counting, and **AI-agent–optimized read/write/edit/shell/listing** tooling for [pi](https://github.com/mariozechner/pi-coding-agent).

**Architecture:** Modular TypeScript extension with 39+ focused modules following SOLID principles. Built on Bun runtime with AST-aware processing, structured JSON output, and intelligent fallback chains.

## Table of Contents

- [Installation](#installation)
- [Architecture](#architecture)
- [Tools](#tools)
- [Enhanced core tools](#enhanced-core-tools-ai-agent-optimized)
- [AI-agent optimization approach](#ai-agent-optimization-approach)
- [Performance and token efficiency](#performance-and-token-efficiency)
- [Quick Decision Flow](#quick-decision-flow)
- [Smart routing](#smart-routing)
- [Requirements](#requirements)
- [Usage](#usage)
- [Development & testing](#development--testing)
- [Documentation](#documentation)
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

## Architecture

pi-sherlock features a **modular, SOLID-compliant architecture** with 39+ focused modules:

### Core Module Structure

```
src/
├── foundation/           # Core infrastructure (Phase 1) 
│   ├── tool-registry/    # Centralized tool registration
│   ├── binary-manager/   # Binary availability detection
│   ├── file-type-registry/ # MIME type and language detection
│   └── command-executor/ # Safe subprocess execution
├── broot/               # Directory topology mapping (Phase 2)
│   ├── types.ts         # Core interfaces and enums
│   ├── file-classifier.ts # Smart file categorization
│   ├── broot-parser.ts  # ASCII tree parsing
│   ├── git-integration.ts # Git status integration
│   ├── tree-filters.ts  # Size/type/depth filtering
│   ├── native-walker.ts # Filesystem traversal fallback
│   └── broot-topology-mapper.ts # Main topology logic
├── ast-editor/          # AST-aware editing system (Phase 2)
│   ├── types.ts         # Edit operation interfaces
│   ├── pattern-builder.ts # AST pattern construction
│   ├── ast-grep-client.ts # External ast-grep integration
│   ├── syntax-validator.ts # Post-edit validation
│   ├── backup-manager.ts # Safe file backup system
│   ├── native-fallback.ts # String-based fallback editing
│   └── ast-file-editor.ts # Main editing orchestrator
├── shell/               # Multi-backend shell execution (Phase 2)
│   ├── types.ts         # Shell backend interfaces
│   ├── pipeline-enhancer.ts # Nushell JSON pipeline injection
│   ├── output-parser.ts # ASCII table and JSON parsing
│   ├── backends/        # Shell backend implementations
│   │   ├── base-backend.ts # Abstract backend interface
│   │   ├── nushell-backend.ts # Structured Nushell execution
│   │   ├── bun-backend.ts # High-performance Bun.$
│   │   └── bash-backend.ts # POSIX-compatible fallback
│   └── nushell-json-executor.ts # Main execution coordinator
└── schemas/             # TypeBox schema definitions (Phase 2)
    ├── shared-fragments.ts # Common schema field definitions
    ├── search-schemas.ts # Search tool parameter schemas
    ├── analysis-schemas.ts # Analysis tool schemas
    └── enhanced-schemas.ts # Enhanced operation schemas
```

### Key Architectural Principles

- **Single Responsibility Principle:** Each module has one clear purpose
- **Dependency Injection:** Testable interfaces with concrete implementations
- **Layered Fallbacks:** Graceful degradation when optional binaries are missing
- **Type Safety:** Comprehensive TypeScript interfaces and validation
- **Backward Compatibility:** Facade pattern maintains existing APIs
- **Comprehensive Testing:** Unit and integration tests for all modules

## Tools

The extension registers **14 tools**. Public names below are what the agent invokes in pi.

### Content search

| Tool | Engine | Description |
|------|--------|-------------|
| `search` | ripgrep | **Default content search.** Regex across file contents. |
| `ripgrep` | ripgrep | Advanced: multiline, hidden files, count mode, fixed strings. |
| `concept_search` | BM25 | Relevance-ranked conceptual search for natural language queries. |

### File & path search

| Tool | Engine | Description |
|------|--------|-------------|
| `find_files` | fd | Find files/directories by name, extension, or type (.gitignore-aware). |
| `fuzzy_find` | fzf | Fuzzy path search for approximate filenames. |

### Structural analysis

| Tool | Engine | Description |
|------|--------|-------------|
| `semgrep` | semgrep | Security audits, bugs, lint-style rules (JSON SARIF-style pipeline). |
| `ast_grep` | ast-grep | Structural search and refactors with metavariables. |

### Code metrics

| Tool | Engine | Description |
|------|--------|-------------|
| `count_lines` | tokei | LOC, comments, and blanks by language. |
| `find_duplicates` | jscpd | Duplicated / copy-pasted code blocks. |

### Enhanced core tools (AI-agent optimized)

| Tool | Role | Summary |
|------|------|---------|
| `read_enhanced` | Smart read router | Routes by MIME/type to **ast-grep skeleton**, **jq** JSON slices, **yq** for YAML-ish data, **bat** highlighting, or native fallbacks—fewer verbatim bytes for large files when structure is enough. |
| `write_enhanced` | Native writer | **Bun** atomic/streaming writes, optional backups—less shell indirection than ad-hoc `echo >>`. |
| `edit_enhanced` | AST-aware edit | **ast-grep** rewrite when possible, native substring fallback, preview/backups—targeted deltas instead of full-file rewrites. |
| `shell_enhanced` | JSON-first shell | Prefer **Nushell** pipelines that coerce to structured JSON tables; Bun shell and POSIX **bash** fallbacks when needed. |
| `ls_enhanced` | Repository topology | **`broot` `:print_tree`** when `br`/`broot` is available; otherwise a deterministic native walker. Emits hierarchical maps + metadata (and optional git hints) tuned for agents. |


## Enhanced core tools (AI-agent optimized)

These five tools intentionally favor **structured, bounded output** over raw terminal dumps so models spend tokens on semantics, not noise.

### `read_enhanced`

- **Examples**
  - Code overview: `{ "path": "src/api.ts", "mode": "skeleton" }` (uses ast-grep when installed).
  - JSON slice: `{ "path": "package.json", "mode": "data", "jqFilter": ".scripts" }`.
  - YAML excerpt: `{ "path": "config.yaml", "mode": "data" }` (yq when installed).
- **Fallbacks**: Missing **jq**, **yq**, **bat**, or **ast-grep** degrade to native readers and plain text; warnings appear in metadata when a tier fails.

### `write_enhanced`

- **Examples**
  - Atomic overwrite with backup: `{ "path": "out.txt", "content": "...", "atomic": true, "backup": true }`.
  - Large payload: `{ "path": "big.json", "content": "...", "useStreamingThreshold": 512000 }`.
- **Fallbacks**: Always Bun-native; failures surface through shared `executeSafe` error shaping.

### `edit_enhanced`

- **Examples**
  - AST refactor with preview: `{ "path": "foo.ts", "pattern": "$X.before()", "replacement": "$X.after()", "previewOnly": true }`.
  - Text fallback for non-code: `{ "path": "README.md", "pattern": "old", "replacement": "new", "useNativeFallback": true }`.
- **Fallbacks**: If **ast-grep** is unavailable or the pattern cannot run, native string edit paths apply where configured.

### `shell_enhanced`

- **Examples**
  - Structured listing: `{ "command": "ls", "enforceJsonPipeline": true }` (Nu injects structured JSON paths when **`nu`** is present).
  - Git status JSON: `{ "command": "git status", "enforceJsonPipeline": true }`.
- **Fallbacks**: **Nu** missing → Bun shell tier → **bash**; each tier still returns coherent error objects.

### `ls_enhanced`

- **Examples**
  - Shallow topology: `{ "path": "src", "depth": 2, "preferBroot": true }`.
  - CI-stable scan: `{ "path": ".", "depth": 3, "preferBroot": false, "filterTypes": ["ts", "code"] }`.
- **Fallbacks**: No **`br`** / **`broot`** → native walker (same structured JSON shape). Session start warns once when neither binary exists.

Shared integration for these tools includes **`executeSafe`** (consistent error envelopes) and **`withOutputTruncation`** on **`read_enhanced`** and **`ls_enhanced`** agent-visible text (`maxChars` / `maxLines` where schemas expose them).

## AI-agent optimization approach

1. **Route by intent** — Classify reads (code vs data vs prose) and pick the smallest faithful representation (skeleton vs slice vs excerpt).
2. **Structured shell** — Prefer machine-parseable JSON (Nushell) before opaque stdout.
3. **Surgical edits** — AST-aware rewrites shrink diffs versus replacing whole files.
4. **Bounded payloads** — Truncation, depth limits, and type/size filters reduce accidental context explosions.
5. **Explicit fallbacks** — Every enhanced tool documents degraded behavior when optional CLIs are missing.

## Performance and token efficiency

| Area | Technique | Typical effect |
|------|-----------|----------------|
| Reads | ast-grep **skeleton** / structure modes vs full paste | Fewer tokens for large modules when callers only need shape and signatures |
| Reads | **jq** / **yq** filters | Agents receive the subtree they asked for instead of entire JSON/YAML files |
| Writes | Bun **atomic rename** | Fast, predictable I/O without shell buffering edge cases |
| Edits | **ast-grep** rewrite | Smaller textual diffs vs whole-file snapshots |
| Shell | Nu **→ JSON** | Tabular(stdout) converted to concise JSON rows instead of raw ANSI tables |
| Listing | Topology JSON + **`depth`** / **`filterTypes`** | Tree-shaped summaries beat dumping thousands of paths |
| All | **`executeSafe`** + truncation on read/list | Stable failure reporting; long outputs clipped with explicit truncation markers |

Exact speedups depend on disk, corpus size, and which optional binaries are installed; the design goal is **lower token variance** and **more parseable artifacts** under the same safety constraints.

## Quick Decision Flow

```
"I know the exact regex"            → search
"I have a concept / idea"         → concept_search
"I need security / linting audit" → semgrep
"I need structural search/refactor" → ast_grep
"I sort of know the filename"     → fuzzy_find
"I know the filename / extension"→ find_files
"I need multiline / hidden / count" → ripgrep
"How many lines of code?"         → count_lines
"Find duplicate code blocks"      → find_duplicates
"Skeleton / slice JSON-YAML?"     → read_enhanced
"Atomic write / backup / large write?" → write_enhanced
"AST refactor / preview diff?"    → edit_enhanced
"JSON-shaped CLI output?"         → shell_enhanced
"Repo layout / tree + metadata?" → ls_enhanced
```

## Smart routing

On **session_start**, pi-sherlock runs a warmup route and notifies that smart routing spans all **14** tools using a **rule engine** plus **JSON decision tree**. `SmartRouter` (see `src/routing/router.ts`) merges both signals with weighted confidence, applies **binary-aware** discounts when optional CLIs are missing, and can **remap** primaries when the live `ToolRegistry` does not register every descriptor (for example `search` / `concept_search` via `supplementalRegisteredTools` in `src/plugin.ts`).

### Examples by category

| Category | Example phrasing | Routed tool |
|----------|------------------|-------------|
| Content search | Regex / default text search | `search` |
| Content search | Multiline rg, `--hidden`, count modes | `ripgrep` |
| Content search | “Related to…”, topical / NL relevance | `concept_search` |
| File discovery | Known globs (`*.tsx`), typed listings | `find_files` |
| File discovery | “Might be called…”, fuzzy filename | `fuzzy_find` |
| Structural analysis | OWASP / SAST-style audit | `semgrep` |
| Structural analysis | Metavar AST patterns | `ast_grep` |
| Metrics | LOC / comment ratios | `count_lines` |
| Metrics | Copy-paste / clone detection | `find_duplicates` |
| Enhanced core | Smart reads, slicing, skeletons | `read_enhanced` |
| Enhanced core | Atomic / streaming saves | `write_enhanced` |
| Enhanced core | AST refactor / previews | `edit_enhanced` |
| Enhanced core | JSON-first shell pipelines | `shell_enhanced` |
| Enhanced core | Repository topology & trees | `ls_enhanced` |

Full behavior, troubleshooting, and merge semantics: **[docs/smart-routing.md](docs/smart-routing.md)**. Per-tool alternates and conflict notes: **[docs/tool-selection-guide.md](docs/tool-selection-guide.md)**.

## Requirements

CLI dependencies are **optional**. On **session_start**, pi-sherlock detects missing binaries and shows installation instructions for any missing tools.

| Binary | Used by | Notes |
|--------|---------|--------|
| `rg` | `search`, `ripgrep` | Core search paths. |
| `semgrep` | `semgrep` | Sandbox/CI note: Semgrep may need write access to its log dir (~/.semgrep). |
| `fzf` | `fuzzy_find` | |
| `fd` | `find_files` | |
| `ast-grep` | `ast_grep`, tiers of `read_enhanced` / `edit_enhanced` | |
| `tokei` | `count_lines` | |
| `jscpd` | `find_duplicates` | |
| `jq` | JSON modes in `read_enhanced` | Falls back to native JSON pretty-print when absent. |
| `yq` (mikefarah) | YAML/TOML-style data reads in `read_enhanced` | |
| `bat` | Highlighting path in `read_enhanced` | |
| `nu` | JSON-first tier in `shell_enhanced` | Bun/bash still work. |
| `br` or `broot` | Faster tree capture in `ls_enhanced` | Native walker if both missing. |

## Usage

After installation, restart **pi**. All **14** tools register automatically. Choose tools using the decision flow above; prompts shipped under `prompts/*.md` expand behavior for humans and routing hints.

## Development & testing

```bash
git clone git@github.com:dmoreq/pi-sherlock.git
cd pi-sherlock
bun install
bun test
```

### Architecture & Testing

- **Modular Architecture**: 39+ focused modules with clear separation of concerns
- **94.7% Test Coverage**: Comprehensive unit and integration testing
- **Mock Injection**: Core logic tests work without requiring all optional CLIs
- **Isolated Testing**: Modules can be tested independently
- **Integration Tests**: Real binary tests require tools on `$PATH` (some need write access to cache dirs like `~/.semgrep`)

### Module Testing Strategy

- **Foundation modules**: Core infrastructure with comprehensive mocking
- **Shell backends**: Multiple execution paths with fallback testing
- **AST editing**: Pattern matching and rewriting with syntax validation
- **Schema validation**: TypeBox schema testing for all tool parameters
- **Backward compatibility**: Facade testing ensures existing APIs continue working

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Architecture Overview](./docs/OVERVIEW.md)** - System architecture and design principles
- **[Documentation Index](./docs/README.md)** - Complete documentation navigation
- **[Smart Routing](./docs/smart-routing.md)** - Intelligent tool selection system
- **[Tool Selection Guide](./docs/tool-selection-guide.md)** - Choosing the right tool for each task

## License

[MIT](LICENSE)
