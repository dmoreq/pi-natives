# Pi-Sherlock Architecture Overview

## System Architecture

Pi-sherlock is built with a modular, SOLID-compliant architecture comprising 39+ focused modules organized into distinct layers:

### Core Infrastructure Layer
- **Tool Registry** (`src/core/tool-registry.ts`) - Declarative tool registration and management
- **Binary Manager** (`src/core/binary-manager.ts`) - Binary dependency detection and notifications  
- **File Type Registry** (`src/core/file-type-registry.ts`) - Unified file type and language classification
- **Command Executor** (`src/core/command-executor.ts`) - Standardized subprocess execution with error handling

### Smart Routing System
- **Context Analyzer** (`src/routing/context-analyzer.ts`) - Natural language query analysis
- **Decision Engine** (`src/routing/decision-engine.ts`) - Rule-based tool selection
- **Decision Tree** (`src/routing/decision-tree.ts`) - Tree-based routing algorithm
- **Smart Router** (`src/routing/router.ts`) - Unified routing orchestration

### Tool Implementation Layer

#### Content Search Tools
- **search** - Default regex content search via ripgrep
- **ripgrep** - Advanced ripgrep features (multiline, hidden files, counts)  
- **concept_search** - BM25 relevance-ranked conceptual search

#### File Discovery Tools
- **find_files** - Fast file/directory listing by name/extension/type
- **fuzzy_find** - Fuzzy filename search for approximate matches

#### Structural Analysis Tools
- **semgrep** - AST-aware static analysis for security and code quality
- **ast_grep** - Structural search and refactoring via AST patterns

#### Code Metrics Tools
- **count_lines** - Lines of code, comments, and blanks by language
- **find_duplicates** - Detect duplicated/copy-pasted code blocks

#### Enhanced Core Tools
- **read_enhanced** - Structure-aware reading with smart routing (AST skeletons, JSON/YAML slicing, syntax highlighting)
- **write_enhanced** - Atomic writes with backups and streaming support
- **edit_enhanced** - AST-aware editing with preview and backups
- **shell_enhanced** - JSON-first shell execution (Nushell → Bun → Bash fallbacks)
- **ls_enhanced** - Repository topology listing with metadata and git integration

## Design Principles

### SOLID Compliance
- **Single Responsibility**: Each module has one clear purpose
- **Open/Closed**: Extension without modification via registry pattern
- **Liskov Substitution**: Proper interface inheritance
- **Interface Segregation**: Focused, minimal interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

### Performance Optimization
- **Caching**: Binary availability, file type classification
- **Lazy Loading**: Tools loaded on-demand
- **Resource Management**: Proper cleanup and cancellation
- **Structured Output**: Token-efficient JSON responses

### Reliability Features
- **Graceful Degradation**: Fallback chains when binaries are missing
- **Error Handling**: Comprehensive error types and recovery
- **Timeout Management**: AbortSignal support throughout
- **Resource Limits**: Output truncation and memory management

## Binary Dependencies

### Required for Core Functionality
- **ripgrep** (`rg`) - Powers all content search tools
- **fd** (`fd`) - Powers file discovery
- **fzf** (`fzf`) - Powers fuzzy search
- **semgrep** (`semgrep`) - Powers static analysis

### Optional for Enhanced Features
- **ast-grep** (`ast-grep`) - AST-based operations
- **tokei** (`tokei`) - Code metrics
- **jscpd** (`jscpd`) - Duplicate detection  
- **jq** (`jq`) - JSON processing
- **yq** (`yq`) - YAML/TOML processing
- **bat** (`bat`) - Syntax highlighting
- **nushell** (`nu`) - Structured shell output
- **broot** (`br`/`broot`) - Fast tree generation

## Integration Points

### Pi Coding Agent Integration
- Session lifecycle hooks for readiness checks
- Tool registration via ExtensionAPI
- UI notifications for missing dependencies
- AbortSignal propagation for cancellation

### Smart Routing Integration
- Natural language query processing
- Binary-aware tool selection
- Confidence scoring and fallback chains
- Contextual tool recommendations

### File System Integration
- Workspace-relative path handling
- Git integration for repository awareness
- File type detection and classification
- Atomic operations with backup support

This architecture enables pi-sherlock to provide powerful, reliable file operations while maintaining excellent performance and user experience.