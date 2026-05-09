# Pi-Sherlock Documentation

This directory contains comprehensive documentation for the pi-sherlock extension.

## Core Documentation

### Architecture & Design
- **[Architecture Overview](./OVERVIEW.md)** - High-level system architecture and design principles
- **[Routing Architecture](./routing-architecture.md)** - Overview of the smart routing system architecture
- **[Smart Routing](./smart-routing.md)** - Detailed routing algorithm and configuration
- **[Decision Tree](./decision-tree.md)** - Decision tree structure and traversal logic
- **[Tool Selection Guide](./tool-selection-guide.md)** - Guide for choosing the right tool for each task

## Quick Navigation

### For Users
- **[../README.md](../README.md)** - Main project README with installation and usage
- **[Tool Selection Guide](./tool-selection-guide.md)** - How to choose the right tool for your task

### For Developers
- **[Routing Architecture](./routing-architecture.md)** - Understanding the routing system
- **[Smart Routing](./smart-routing.md)** - Implementation details and configuration
- **[Decision Tree](./decision-tree.md)** - Tree configuration and traversal

## Tool Categories

### Content Search
- `search` - Default regex content search via ripgrep
- `ripgrep` - Advanced ripgrep features (multiline, hidden files, counts)
- `concept_search` - BM25 relevance-ranked conceptual search

### File Discovery
- `find_files` - Fast file/directory listing by name/extension/type
- `fuzzy_find` - Fuzzy filename search for approximate matches

### Structural Analysis
- `semgrep` - AST-aware static analysis for security and code quality
- `ast_grep` - Structural search and refactoring via AST patterns

### Code Metrics
- `count_lines` - Lines of code, comments, and blanks by language
- `find_duplicates` - Detect duplicated/copy-pasted code blocks

### Enhanced Core Tools
- `read_enhanced` - Structure-aware reading with smart routing
- `write_enhanced` - Atomic writes with backups and streaming
- `edit_enhanced` - AST-aware editing with preview and backups
- `shell_enhanced` - JSON-first shell execution with multiple backends
- `ls_enhanced` - Repository topology listing with metadata

## Tool Requirements

### Required Tools (Core Functionality)
- **ripgrep** (`rg`) - Powers search, ripgrep, concept_search
- **fd** (`fd`) - Powers find_files
- **fzf** (`fzf`) - Powers fuzzy_find
- **semgrep** (`semgrep`) - Powers semgrep tool

### Optional Tools (Enhanced Features)
- **ast-grep** (`ast-grep`) - Powers ast_grep and enhanced AST features
- **tokei** (`tokei`) - Powers count_lines
- **jscpd** (`jscpd`) - Powers find_duplicates
- **jq** (`jq`) - Enhances read_enhanced for JSON processing
- **yq** (`yq`) - Enhances read_enhanced for YAML/TOML processing
- **bat** (`bat`) - Enhances read_enhanced with syntax highlighting
- **nushell** (`nu`) - Enhances shell_enhanced with structured output
- **broot** (`br`/`broot`) - Enhances ls_enhanced with fast tree generation

## Prompt Files

All tools have detailed prompt files in the [`../prompts/`](../prompts/) directory that provide:
- Tool description and capabilities
- Parameter schemas and examples
- Usage patterns and best practices
- Integration with other tools

## Skills

Tool-specific skills are available in the [`../skills/`](../skills/) directory for advanced usage patterns and domain-specific guidance.