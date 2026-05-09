/**
 * Pattern building utilities for AST editor
 * 
 * Converts user input into ast-grep patterns and handles scope reservations.
 */

import type { AstEditOptions, AstEditResult } from "./types";
import { AstEditError } from "../shared/errors";

/**
 * Map structural edit intent to ast-grep pattern strictness.
 */
export function strictnessForNodeType(
	nodeType?: AstEditOptions["nodeType"],
): { strict: boolean; preFilter?: string } {
	switch (nodeType) {
		case "function":
			return { strict: true, preFilter: "function" };
		case "class":
			return { strict: true, preFilter: "class" };
		case "method":
			return { strict: true, preFilter: "method" };
		case "variable":
			return { strict: true, preFilter: "variable" };
		default:
			return { strict: false }; // Generic/no type hint
	}
}

/**
 * Convert user pattern to ast-grep rewrite pattern, applying type hints if needed.
 */
export function buildRewritePattern(
	userPattern: string,
	nodeType?: AstEditOptions["nodeType"],
): string {
	if (!userPattern?.trim()) {
		throw new AstEditError("Pattern cannot be blank");
	}

	const trimmed = userPattern.trim();
	
	// If nodeType is specified, we could enhance the pattern here
	// For now, pass through as-is but validate
	if (nodeType && nodeType !== "generic") {
		// Future: could wrap pattern with type-specific context
		// e.g., for "function" nodeType: "function $name($$$args) { $$$ }"
	}
	
	return trimmed;
}

/**
 * Check for reserved scope usage and return warning messages.
 */
export function scopeReservationWarnings(scope: AstEditOptions["scope"] | undefined): string[] {
	const warnings: string[] = [];
	
	if (scope === "function" || scope === "class") {
		warnings.push(`Scope '${scope}' is reserved for future nested-scope rewrites. Currently behaves like 'file' scope.`);
	}
	
	return warnings;
}

/**
 * Attach warnings to a result object.
 */
export function attachWarnings<T extends AstEditResult>(result: T, extra: string[]): T {
	if (extra.length > 0) {
		result.warnings = [...result.warnings, ...extra];
	}
	return result;
}