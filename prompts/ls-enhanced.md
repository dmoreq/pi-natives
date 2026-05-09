# `ls_enhanced` — Enhanced Directory Listing

Builds a **repository topology** (nested `DirectoryNode` tree) with optional **broot** (`:print_tree`) acceleration and a **native filesystem** fallback that mirrors the same JSON shape.

## What you get

- **Hierarchy** — children arrays mirror on-disk structure (depth-limited).
- **Metadata** — `kind`, `extension`, `fileCategory`, `sizeBytes` (files + symlinks when known).
- **Git** — `gitStatus` carries concise `git status --porcelain=v1` XY codes when the root sits inside a repo (`includeGitStatus`, default on).
- **Filtering** — `filterTypes` accepts extensions (`ts`), coarse categories (`code`, `config`, …), or structural kinds (`directory`, `symlink`).
- **Deterministic JSON** — under `---topology_json---` in the agent-visible payload for downstream tooling.

## When to use vs other tools

| Need | Prefer |
|------|--------|
| Project skeleton / onboarding | **`ls_enhanced`** |
| Huge monorepo first pass | **`ls_enhanced`** (`depth`, `filterTypes`) |
| Flat filename search | **`find_files`** |
| Scripted JSON rows (`ls`, `git status`) | **`shell_enhanced`** |

## Operational notes

- **broot** availability is detected via `br`/`broot` on `PATH`; missing binaries transparently degrade to fs scans (`method: native` in stats lines).
- **`.git` internals never expand** — matches the conservative native walker.
- Respect agent truncation defaults; narrow `depth`/filters proactively on sprawling trees.
