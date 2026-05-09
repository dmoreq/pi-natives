/**
 * Native string replacement fallback for non-code files
 */

import type { AstChange, AstEditResult } from "./types";

/**
 * Count literal string occurrences in text
 */
export function countLiteralOccurrences(haystack: string, needle: string): number {
	if (!needle) return 0;
	
	let count = 0;
	let index = 0;
	
	while ((index = haystack.indexOf(needle, index)) !== -1) {
		count++;
		index += needle.length;
	}
	
	return count;
}

/**
 * Replace all literal occurrences of a string
 */
export function replaceAllLiteral(haystack: string, needle: string, replacement: string): string {
	if (!needle) return haystack;
	
	let result = haystack;
	while (result.includes(needle)) {
		result = result.replace(needle, replacement);
	}
	
	return result;
}

/**
 * Generate synthetic change objects for native replacements
 */
export function syntheticNativeChanges(count: number): AstChange[] {
	return Array.from({ length: count }, (_, i) => ({
		line: i + 1, // Synthetic line numbers
		column: 0,
		before: "literal match",
		after: "literal replacement"
	}));
}

/**
 * Format a preview diff for native string replacement
 */
export function formatNativePreview(relName: string, before: string, after: string): string {
	const beforeLines = before.split("\n");
	const afterLines = after.split("\n");
	
	// Simple diff format showing the change
	let diff = `--- ${relName} (before)\n+++ ${relName} (after)\n`;
	
	const maxLines = Math.max(beforeLines.length, afterLines.length);
	
	for (let i = 0; i < maxLines; i++) {
		const beforeLine = beforeLines[i] || "";
		const afterLine = afterLines[i] || "";
		
		if (beforeLine !== afterLine) {
			if (beforeLine) {
				diff += `-${beforeLine}\n`;
			}
			if (afterLine) {
				diff += `+${afterLine}\n`;
			}
		} else if (beforeLine) {
			diff += ` ${beforeLine}\n`;
		}
	}
	
	return diff;
}

/**
 * Perform native string replacement editing
 */
export function performNativeEdit(
	content: string,
	pattern: string,
	replacement: string,
	filePath: string,
	preview: boolean = false
): AstEditResult {
	const matchCount = countLiteralOccurrences(content, pattern);
	
	if (matchCount === 0) {
		return {
			summary: `No literal matches found for pattern in ${filePath}`,
			matchCount: 0,
			totalChanges: 0,
			method: "native-string",
			warnings: [],
			syntaxValid: true
		};
	}
	
	const result: AstEditResult = {
		summary: `Replaced ${matchCount} literal occurrence${matchCount === 1 ? "" : "s"} in ${filePath}`,
		matchCount,
		totalChanges: matchCount,
		method: "native-string",
		warnings: [],
		syntaxValid: true // Native string replacement doesn't break syntax
	};
	
	if (preview) {
		const modifiedContent = replaceAllLiteral(content, pattern, replacement);
		result.preview = formatNativePreview(filePath, content, modifiedContent);
		result.previewDiff = result.preview;
		result.changes = syntheticNativeChanges(matchCount);
	}
	
	return result;
}