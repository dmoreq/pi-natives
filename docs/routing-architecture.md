# Smart routing architecture (Task 1)

This document describes the Phase 1 smart-routing **foundation**: how natural-language context is converted into a `ToolContext`, how rules select a `RoutingDecision`, and how that layer sits on existing **core** modules.

> **Note on paths:** The implementation plan refers to `src/foundation/*`. In this repository the same responsibilities live under **`src/core/`** (`file-type-registry`, `binary-manager`, `tool-registry`, `command-executor`). Routing imports those modules directly.

---

## Components

| Layer | Module | Responsibility |
| ----- | ------ | -------------- |
| Types | `src/routing/types.ts` | `ToolContext`, `RoutingDecision`, `RoutingRule`, binary snapshot types, union of the 14 Pi tool names. |
| Context | `src/routing/context-analyzer.ts` | Heuristic NLP-style classification: intent, specificity, scope, patterns, feature tags, optional file classification, **binary snapshot** via `BinaryManager` + `createBinaryRequirements()`. |
| Rules | `src/routing/decision-engine.ts` | Priority-ordered rules with optional `blockingConditions` and `requiredBinaries`, confidence + reasoning, deterministic fallbacks. |
| Barrel | `src/routing/index.ts` | Public exports for downstream tasks (router, prompts, plugin hooks). |

---

## Data flow

1. **Analyzer** — `ContextAnalyzer.analyzeQuery(query, filePath?)` returns a `ToolContext`.  
   - **File types:** `FileTypeRegistry.classify` (via injectable `defaultFileTypeClassifier`) when `filePath` is present.  
   - **Binaries:** `snapshotBinaryAvailability(BinaryManager)` merges every `BinaryRequirement` from `createBinaryRequirements()` into `binaryAvailability.byBinary[exe]`.
2. **Engine** — `DecisionEngine.decide(context)`  
   - Keeps rules whose `conditions` ⊆ `context` (partial match, with feature-subset semantics).  
   - Drops rules matched by `blockingConditions`.  
   - Drops rules whose `requiredBinaries` are not `available: true` in the snapshot.  
   - Sorts by `priority`, picks the winner, attaches secondaries, reasoning, and `TOOL_FALLBACKS`.

No network or subprocess work happens inside the engine; binary checks are isolated in the analyzer snapshot (cached on `BinaryManager`).

---

## Matching semantics

- **Primitives** (`intent`, `specificity`, …) require strict equality.  
- **`features`** in a rule: each listed tag must appear in `context.features`.  
- **`fileContext`** in a rule: only the fields present in the partial are compared to `FileClassification` (e.g. `{ type: FileType.CODE }`).  
- **Empty `blockingConditions` or all-`undefined`** does *not* block (guards against accidental `{}`).

---

## Tool coverage

The 14 routed tool names match `src/plugin.ts` registrations:

`search`, `concept_search`, `find_files`, `fuzzy_find`, `ripgrep`, `semgrep`, `ast_grep`, `count_lines`, `find_duplicates`, `read_enhanced`, `write_enhanced`, `edit_enhanced`, `shell_enhanced`, `ls_enhanced`.

---

## Extension points (Task 2+)

- **Custom rules:** `new DecisionEngine(customRules)` merges with or replaces `defaultRules()` (today: pass a full list if you need a clean override).  
- **Router:** Combine `ContextAnalyzer` + `DecisionEngine` (and later a decision tree / `SmartRouter`).  
- **Plugin:** Optional `session_start` hook can surface routing hints or pre-warm binary snapshots.  
- **`CommandExecutor`:** Not invoked from routing yet; reserved for future probes or capability checks.

---

## Tests

- `tests/routing/routing-architecture.test.ts` — end-to-end analyzer + engine cases and binary-gated fallbacks.  
- `tests/routing/test-helpers.ts` — `allBinariesAvailableSnapshot()` for deterministic CI.

Run: `bun test tests/routing/`.
