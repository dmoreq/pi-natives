/**
 * Broot topology module - main exports
 * 
 * Provides directory topology mapping with broot integration and native fallback.
 */

// Main orchestrator
export { BrootTopologyMapper, resolveBrootBinary } from "./broot-topology-mapper";

// Core types
export type {
	DirectoryKind,
	FileCategory,
	DirectoryNode,
	BrootOptions,
	BrootResult,
	ParsedTreeRow
} from "./types";

// Parsing utilities (for testing and advanced usage)
export { parsePrintTreeRows, topologyFromPrintTreeStdout } from "./broot-parser";

// Git integration
export { gitRepoRoot, porcelainStatusMap, applyGitStatus } from "./git-integration";

// Tree manipulation utilities
export {
	normalizedTypeFilters,
	pruneHidden,
	collapseDotGitSubtree,
	filterTree,
	applyDepthLimit,
	summarizeTotals
} from "./tree-filters";

// File classification
export { categorizeExtension, classifyNode } from "./file-classifier";

// Native walker (for advanced usage)
export { NativeWalker } from "./native-walker";