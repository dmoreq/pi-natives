---
name: pi-sherlock-ls-enhanced
description: Intelligent repository topology — nested directory tree with file metadata, git status codes, and broot acceleration
---

# pi-sherlock-ls-enhanced: Intelligent Directory Listing

**Trigger:** You need to understand the STRUCTURE of a project or directory — a visual topology with metadata and git awareness. Use at session start or when exploring an unfamiliar codebase.

## Tool Selection

```
Project structure / topology?      → ls_enhanced  ← YOU ARE HERE
Flat list of files by name/ext?    → find_files
Structured CLI output (ls/git)?    → shell_enhanced
Fuzzy filename search?             → fuzzy_find
```

## What You Get

- **Nested tree** — hierarchical `DirectoryNode` structure (depth-limited)
- **Metadata** — `kind`, `extension`, `fileCategory`, `sizeBytes` per entry
- **Git status** — porcelain `XY` codes (`M`, `A`, `D`, `?`) per file
- **Deterministic JSON** — `---topology_json---` block for downstream tooling
- **broot acceleration** — uses `broot :print_tree` when available; falls back to native walker

## Parameters

| Parameter | Effect | Default |
|-----------|--------|---------|
| `path` | Directory to map | workspace cwd |
| `depth` | Max recursion depth | `12` |
| `filterTypes` | Filter by extension, category, or kind | none (all files) |
| `includeGitStatus` | Attach git XY codes per file | `true` |
| `includeHidden` | Include dotfiles / hidden dirs | `false` |
| `minSizeBytes` | Only files ≥ this size | — |
| `maxSizeBytes` | Only files ≤ this size | — |
| `preferBroot` | Use broot when available | `true` |

## `filterTypes` Values

| Value | What it includes |
|-------|-----------------|
| `"ts"`, `"py"`, `"rs"` | Files with that extension |
| `"code"` | All source code files |
| `"config"` | Config files (JSON, YAML, TOML, etc.) |
| `"markup"` | Markdown, HTML, etc. |
| `"doc"` | Documentation files |
| `"data"` | Data files (CSV, SQL, etc.) |
| `"directory"` | Directory entries only |
| `"symlink"` | Symlink entries only |

## Usage Patterns

```
# Project overview on session start
path: "."  depth: 3

# TypeScript source map only
path: "src/"  filterTypes: ["ts", "directory"]

# Config files only (for CI/build understanding)
filterTypes: ["config"]

# Large monorepo — shallow overview first
path: "."  depth: 2  filterTypes: ["directory"]

# Find recently changed files (git status)
path: "."  includeGitStatus: true  depth: 4

# Include dotfiles (e.g. .github, .env.example)
path: "."  includeHidden: true  depth: 2
```

## Git Status Codes

The `gitStatus` field uses git's porcelain XY codes:

| Code | Meaning |
|------|---------|
| `M` | Modified |
| `A` | Added / staged |
| `D` | Deleted |
| `R` | Renamed |
| `??` | Untracked |
| (blank) | Unmodified |

## Guidelines

1. **Start every unfamiliar codebase** with `ls_enhanced` at `depth: 3` before diving in.
2. **Narrow `depth`** on monorepos — `depth: 2` for the first overview, expand sections you need.
3. Use `filterTypes: ["ts", "directory"]` to see only TypeScript source + folder structure.
4. `.git` internals never expand — the walker skips them automatically.
5. If `broot` is slow or unavailable, set `preferBroot: false` for the native fs walker.
6. For flat file lists by extension, prefer `find_files` — `ls_enhanced` is for topological maps.

## Do NOT use for

- Flat file lists by name/extension → `find_files`
- Fuzzy filename search → `fuzzy_find`
- Scripted `ls` / `git status` JSON rows → `shell_enhanced`
- Content search → `search`
