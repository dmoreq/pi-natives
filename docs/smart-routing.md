# Smart routing

pi-sherlock ships a **unified router** (`SmartRouter`) that turns a natural-language task description (plus optional file path hints) into a **primary tool**, **alternates**, **confidence**, **reasoning lines**, and **fallbacks**. The goal is consistent tool choice across all **14** public tools so agents and humans converge on the same entry points.

## How it works (pipeline)

1. **Context analysis** (`ContextAnalyzer`)  
   Parses the query into a `ToolContext`: dominant **intent** (search, find, analyze, count, refactor, read, write, edit, shell, list), **specificity** (exact, fuzzy, conceptual, structural), **scope** (content, structure, files, metrics, operations), pattern flags (**hasPattern**, **patternType**), optional **features** (e.g. `security-audit`, `ripgrep-advanced`), optional **file classification** when `filePath` is passed, and a **binary availability snapshot** from `BinaryManager`.

2. **Rule engine** (`DecisionEngine`)  
   Matches ordered **routing rules** against `ToolContext`. Rules can require specific binaries (`rg`, `fd`, `semgrep`, …). When nothing matches, a **default** is derived from intent (see `INTENT_DEFAULT_PRIMARY` in `src/routing/decision-engine.ts`) with optional **binary-aware remapping** along `ROUTING_TOOL_FALLBACKS`.

3. **Decision tree** (`DecisionTree`)  
   Traverses `src/routing/tree-config.json`: branch scoring by intent, features, pattern type, and specificity. Leaves attach **base confidence** and optional **required binaries**.

4. **Merge** (`SmartRouter.combineDecisions`)  
   Combines engine and tree outputs with configurable weights (**default:** engine **0.52**, tree **0.48**).  
   - If both agree on the primary tool, confidence is boosted (capped at **0.97**) and reasoning merges **“Rule engine + decision tree agree”** with tree path notes.  
   - If they disagree, each side’s confidence is scaled by its weight; if a candidate’s **required binaries** are missing, that side’s weighted score is multiplied by **0.65** before comparison. The winner becomes primary; the loser is pushed into **secondaryTools**. Reasoning always includes a **“Merged routing:”** line with weighted scores when sources differ.

5. **Registration filter** (`applyRegistrationFilter`)  
   If a `ToolRegistry` is supplied, the router may **remap** the primary to the first registered candidate among secondaries, fallbacks, and transitive `ROUTING_TOOL_FALLBACKS` (e.g. when `search` / `concept_search` are not registered as descriptors but are still used in practice—see `supplementalRegisteredTools` in `src/plugin.ts`).

## Routing logic details

### Confidence (rule engine)

When at least one rule matches, base score starts around **0.62**, increases with the winning rule’s **priority** (scaled, capped), gets a small bump when multiple rules match, and can drop if required binaries are reported unavailable. Result is capped at **0.97**.

### Confidence (decision tree)

Leaves define **baseConfidence** (e.g. **0.9** for a strong conceptual search). If required leaf binaries are unsatisfied, the merge step treats the tree as **blocked** (weighted score × **0.65**) and records that in reasoning.

### Combined confidence (disagreement)

When primary tools differ, merged confidence is a blend of weighted scores plus a fraction of the other side’s signal (see implementation in `src/routing/router.ts`), still capped at **0.97**.

### Fallback chains

`ROUTING_TOOL_FALLBACKS` encodes ordered alternates (e.g. `search` → `ripgrep` → `concept_search`). Defaults and registration remapping use this graph to pick a viable tool when the first choice is missing from the registry or blocked by binaries.

### Binary availability impact

- **Rule engine:** rules with unsatisfied `requiredBinaries` are **skipped** entirely. Defaults can **substitute** the next reachable tool whose binaries exist.  
- **Merge:** unsatisfied binaries on either engine or tree path **discount** that side during disagreement.  
- **Runtime:** the extension still notifies on missing CLIs at `session_start`; routing uses the same availability snapshot **at route time**.

### Enhanced tools vs builtins

Routing only selects among pi-sherlock’s **14 registered tools**. It does **not** invoke Cursor/pi builtins (`read_file`, …). Documentation and README describe when an **enhanced** pi-sherlock tool is preferable to a builtin for **token-efficient** or **structured** output; the router encodes those preferences when the query mentions smart read/write/edit/shell/list patterns.

## Where to look in code

| Piece | Location |
|--------|-----------|
| Types | `src/routing/types.ts` |
| Query → context | `src/routing/context-analyzer.ts` |
| Rules & fallbacks | `src/routing/decision-engine.ts` |
| Tree config | `src/routing/tree-config.json` |
| Tree engine | `src/routing/decision-tree.ts` |
| Merge + registry filter | `src/routing/router.ts` |
| Plugin wiring | `src/plugin.ts` (`SmartRouter`, session ping, notification) |

## Related docs

- **[Tool selection guide](./tool-selection-guide.md)** — per-tool matrix and alternates  
- **[Decision tree](./decision-tree.md)** — branch reference  
- **README — Smart routing** — quick examples and categories  

## Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|-------------|
| Primary is **`ripgrep`** but you expected **`search`** | Registry filter: `search` not treated as registered | Ensure descriptors + `supplementalRegisteredTools` match your deployment (`src/plugin.ts`). |
| **`semgrep`** never wins on security wording | **`semgrep` binary** missing | Install binary; discounted tree/engine paths will prefer **`ast_grep`** or **`search`**. |
| **`concept_search`** remapped unexpectedly | **`concept_search`** not in registered set | Add to supplemental list or register the tool explicitly. |
| **`find_files` vs `fuzzy_find`** feels wrong | **Specificity**: fuzzy phrases (“might be called”, “approximately”) steer **`fuzzy_find`**; explicit globs/extensions steer **`find_files`**. Rephrase or pass clearer file hints. |
| Low confidence / generic reasoning | Few rules matched; **default intent** path | Add more specific verbs (Owasp/SAST → analyze, skeleton read → read_enhanced, etc.). |
| Disagreement lines every time | Engine and tree pick different primaries | Normal for borderline queries; check **secondaryTools** and **`fallbacks`**; adjust query or install missing binaries so both layers align. |

For tests that exercise merge behavior, binaries, and fallbacks, see `tests/routing/integration.test.ts` and `tests/routing/end-to-end.test.ts`.
