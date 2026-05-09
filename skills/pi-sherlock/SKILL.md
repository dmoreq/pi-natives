---
name: pi-sherlock
description: High-performance file search, structural analysis, and AI-agent-optimized core tools — modular TypeScript architecture with 14 specialized tools
---

# pi-sherlock: Comprehensive Development Tooling

This package provides 14 specialized tools for file operations, content search, structural analysis, and AI-agent-optimized core functionality. Built with a modular architecture following SOLID principles.

## Architecture Overview

**Modular Design:** 39+ focused modules with clear separation of concerns  
**SOLID Principles:** Single responsibility, dependency injection, and clean abstractions  
**94.7% Test Coverage:** Comprehensive testing with robust error handling  
**Intelligent Fallbacks:** Graceful degradation when optional binaries are missing

## Trigger Decision

| Your intent | Primary Tool | Alternative/Advanced |
|---|---|---|
| "I know the exact regex pattern" | **`search`** | `ripgrep` (advanced options) |
| "I have a concept/idea and want relevant files" | **`concept_search`** | - |
| "I sort of know the filename" | **`fuzzy_find`** | `find_files` (exact matching) |
| "I know the filename or extension" | **`find_files`** | - |
| "I need code structure/security analysis" | **`semgrep`** | `ast_grep` (refactoring) |
| "I need AST-based search/refactor" | **`ast_grep`** | - |
| "I need code metrics/line counts" | **`count_lines`** | - |
| "I need to find duplicate code" | **`find_duplicates`** | - |
| "I need smart file reading" | **`read_enhanced`** | - |
| "I need atomic/streaming writes" | **`write_enhanced`** | - |
| "I need AST-aware editing" | **`edit_enhanced`** | - |
| "I need structured shell output" | **`shell_enhanced`** | - |
| "I need intelligent directory listing" | **`ls_enhanced`** | - |

## Tool Categories

### Content Search Tools

#### `search` — Regex File Search (ripgrep)
**Trigger:** You have a PRECISE regex pattern and need to search file CONTENTS.

This is your DEFAULT content search tool. Fast, `.gitignore`-aware, with structured output.

**Key features:**
- Full regex syntax (e.g., `log.*Error`, `function\\s+\\w+`)
- Context lines, case-insensitive mode
- Glob and file-type filtering

#### `ripgrep` — Advanced Content Search
**Trigger:** You need advanced ripgrep features beyond basic search.

**Advanced features:**
- Multiline matching, hidden files, count-only mode
- Fixed strings (non-regex), output mode selection
- Timeout controls, column limits

#### `concept_search` — Relevance-Ranked Search (BM25)
**Trigger:** You have a CONCEPT or IDEA but don't know exact terms.

**Key features:**
- Natural language queries
- BM25 relevance scoring
- Sorted by semantic relevance

### File & Path Discovery

#### `find_files` — File Discovery (fd)
**Trigger:** You know filename, extension, or file type patterns.

**Key features:**
- Fast file/directory discovery
- Extension and type filtering
- `.gitignore`-aware by default

#### `fuzzy_find` — Fuzzy Path Search (fzf)
**Trigger:** You sort of know the filename but need fuzzy matching.

**Key features:**
- Approximate filename matching
- Interactive-style fuzzy search
- Path-based discovery

### Structural Analysis

#### `semgrep` — Security & Code Analysis
**Trigger:** You need security audits, bug detection, or lint-style analysis.

**Key features:**
- Security pattern detection
- Custom rule configurations
- SARIF-style JSON output

#### `ast_grep` — AST Search & Refactor
**Trigger:** You need structural code search or automated refactoring.

**Key features:**
- AST-based pattern matching
- Metavariable support for complex patterns
- Code rewriting capabilities

### Code Metrics

#### `count_lines` — Code Metrics (tokei)
**Trigger:** You need lines of code, comments, and language statistics.

**Key features:**
- Multi-language support
- Comments vs code separation
- Per-file or summary statistics

#### `find_duplicates` — Duplicate Detection (jscpd)
**Trigger:** You need to find copy-pasted or duplicated code blocks.

**Key features:**
- Configurable similarity thresholds
- Multiple output formats
- Language-aware duplicate detection

### Enhanced Core Tools (AI-Agent Optimized)

#### `read_enhanced` — Smart File Reading
**Trigger:** You need intelligent, structure-aware file reading.

**Key features:**
- AST skeleton for code files (ast-grep)
- JSON/YAML data slicing (jq/yq)
- Syntax highlighting (bat)
- Smart truncation and token efficiency

#### `write_enhanced` — Atomic File Writing
**Trigger:** You need reliable, high-performance file writing.

**Key features:**
- Atomic operations with temp files
- Streaming for large files
- Automatic backup options
- Native Bun runtime optimization

#### `edit_enhanced` — AST-Aware Editing
**Trigger:** You need syntax-aware file editing without breaking code structure.

**Key features:**
- AST-based editing (ast-grep)
- Preview mode for safe testing
- Automatic backup creation
- Native fallback for non-code files

#### `shell_enhanced` — Structured Shell Execution
**Trigger:** You need shell commands with structured, parseable output.

**Key features:**
- Nushell JSON pipeline injection
- Eliminates parsing ambiguity
- Multiple backend fallbacks (Bun, bash)
- Structured error handling

#### `ls_enhanced` — Intelligent Directory Listing
**Trigger:** You need repository-aware directory structure understanding.

**Key features:**
- Broot-based topology mapping
- Git status integration
- Intelligent depth control
- Token-efficient tree representation

## Usage Guidelines

### Tool Selection Strategy
1. **Content Search:** Default to `search` for precise patterns, `concept_search` for ideas
2. **File Discovery:** Use `find_files` for known patterns, `fuzzy_find` for approximate matches
3. **Code Analysis:** Use `semgrep` for security/quality, `ast_grep` for structural search/refactor
4. **Enhanced Operations:** Prefer enhanced tools for AI-agent-optimized performance and output
5. **Never Shell Out:** Always use pi-sherlock tools instead of raw `grep`/`rg`/`find`/`ls` commands

### AI Agent Optimization
- **Enhanced tools prioritize token efficiency** over raw performance
- **Structured output** reduces parsing errors and hallucinations  
- **Smart routing** automatically selects optimal processing approach
- **Graceful fallbacks** ensure functionality even without optional binaries

### Tool Combinations
- **Discovery + Analysis:** `find_files` → `semgrep` → `ast_grep`
- **Search + Refactor:** `search` → `ast_grep` editing
- **Metrics + Cleanup:** `count_lines` → `find_duplicates`
- **Read + Edit:** `read_enhanced` → `edit_enhanced` → verification

## Architecture & Performance

### Modular Architecture Benefits
- **39+ Focused Modules:** Single-responsibility components with clear interfaces
- **SOLID Principles:** Dependency injection, open/closed principle compliance
- **94.7% Test Coverage:** Comprehensive testing with mock injection for external dependencies
- **Intelligent Fallbacks:** Graceful degradation when optional binaries are missing

### Output Size Management

All pi-sherlock tools apply automatic output truncation to prevent excessive token consumption:

- **200 lines max** — outputs beyond this are truncated to the first 200 lines
- **10,000 characters max** — outputs beyond this are truncated to 10K chars
- Both limits applied independently (whichever hits first)
- Clear truncation indicators: `(truncated: showed N/M lines, X/Y chars)`
- **Enhanced tools** use smart truncation at meaningful boundaries

### Binary Dependencies

Pi-sherlock gracefully handles missing optional binaries:

| Binary | Used By | Fallback Behavior |
|--------|---------|-------------------|
| `rg` | `search`, `ripgrep` | **Required** - Core search functionality |
| `fd` | `find_files` | **Required** - File discovery |
| `fzf` | `fuzzy_find` | **Required** - Fuzzy matching |
| `semgrep` | `semgrep` | **Required** - Security analysis |
| `ast-grep` | `ast_grep`, `read_enhanced`, `edit_enhanced` | Native fallbacks available |
| `tokei` | `count_lines` | **Required** - Code metrics |
| `jscpd` | `find_duplicates` | **Required** - Duplicate detection |
| `jq` | `read_enhanced` | Native JSON parsing fallback |
| `yq` | `read_enhanced` | Native YAML/TOML parsing fallback |  
| `bat` | `read_enhanced` | Plain text fallback |
| `nu` | `shell_enhanced` | Bun and bash fallbacks |
| `broot` | `ls_enhanced` | Native filesystem walker fallback |

**Session start** provides clear notifications about missing optional binaries and their impact on enhanced functionality.
