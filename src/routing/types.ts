/**
 * Smart routing type definitions aligned with Phase 2 core foundations.
 *
 * Foundations live under src/core/: file-type-registry, binary-manager, tool-descriptor.
 */

import type { FileClassification } from "../core/file-type-registry";
import type { BinaryCheckResult } from "../core/binary-manager";

/** Public names of Pi tools registered by pi-sherlock (matches `name:` in tools). */
export type PiSherlockToolName =
	| "search"
	| "concept_search"
	| "find_files"
	| "fuzzy_find"
	| "ripgrep"
	| "semgrep"
	| "ast_grep"
	| "count_lines"
	| "find_duplicates"
	| "read_enhanced"
	| "write_enhanced"
	| "edit_enhanced"
	| "shell_enhanced"
	| "ls_enhanced";

export type ToolIntent =
	| "search"
	| "find"
	| "analyze"
	| "count"
	| "refactor"
	| "read"
	| "write"
	| "edit"
	| "shell"
	| "list";

export type SpecificityKind = "exact" | "fuzzy" | "conceptual" | "structural";

export type ScopeKind = "content" | "structure" | "files" | "metrics" | "operations";

export type PatternKind = "regex" | "glob" | "natural" | "ast" | "semantic";

export interface BinaryAvailabilitySnapshot {
	/** Executable key (matches `binary` field on BinaryRequirement, e.g. rg, nu, ast-grep). */
	byBinary: Record<string, Pick<BinaryCheckResult, "available" | "error">>;
}

/**
 * Resolved routing context derived from natural language plus optional filesystem hints.
 */
export interface ToolContext {
	intent: ToolIntent;
	specificity: SpecificityKind;
	scope: ScopeKind;
	hasPattern: boolean;
	patternType?: PatternKind;
	/** Optional semantic tags inferred from wording (duplicate detection, security audit, …). */
	features?: string[];
	/** Classification from {@link ../core/file-type-registry} when `filePath` is provided. */
	fileContext?: FileClassification;
	/** Cached binary probes from BinaryManager — used by rules with `requiredBinaries`. */
	binaryAvailability?: BinaryAvailabilitySnapshot;
	performancePreference?: "speed" | "accuracy" | "token_efficiency";
}

export interface RoutingDecision {
	primaryTool: PiSherlockToolName | string;
	secondaryTools: string[];
	confidence: number;
	reasoning: string[];
	fallbacks: string[];
	enhancedFeatures?: string[];
	/** Executable names (`binary` strings) preferred by this route. */
	binaryRequirements?: string[];
}

export interface RoutingRule {
	conditions: Partial<ToolContext>;
	tool: PiSherlockToolName | string;
	/** Higher beats lower when multiple rules match. */
	priority: number;
	blockingConditions?: Partial<ToolContext>;
	requiredBinaries?: string[];
	/** Optional hint if this rule targets an enhanced pathway. */
	enhancedAlternative?: string;
}
