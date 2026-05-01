/**
 * Shared utility functions used across pi-sherlock tools.
 */

/**
 * Strip trailing newline from a string.
 * Replaces duplicated stripTrailingNewline() in ripgrep.ts.
 */
export function stripTrailingNewline(s: string): string {
	return s.replace(/\r?\n$/, "");
}

/**
 * Truncate a line to maxColumns characters.
 * Replaces duplicated truncateLine() in ripgrep.ts and regex-engine.ts.
 */
export function truncateLine(line: string, maxColumns?: number): string {
	if (maxColumns === undefined || line.length <= maxColumns) return line;
	return line.slice(0, maxColumns);
}

/**
 * Extract a snippet around the first occurrence of query terms.
 * Used by BM25 search result display.
 */
export function extractSnippet(text: string, query: string, maxLen: number): string {
	const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
	const lower = text.toLowerCase();

	// Find first occurrence of any query term
	let bestIdx = -1;
	for (const term of terms) {
		const idx = lower.indexOf(term);
		if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
			bestIdx = idx;
		}
	}

	if (bestIdx < 0) {
		// No term found — return start of text
		return text.slice(0, maxLen).replace(/\n/g, " ");
	}

	// Center snippet around the match
	const start = Math.max(0, bestIdx - Math.floor(maxLen / 2));
	const end = Math.min(text.length, start + maxLen);
	let snippet = text.slice(start, end).replace(/\n/g, " ");

	if (start > 0) snippet = "\u2026" + snippet;
	if (end < text.length) snippet = snippet + "\u2026";

	return snippet;
}

/**
 * Escape regex special characters — used when a regex pattern fails to compile.
 */
export function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
