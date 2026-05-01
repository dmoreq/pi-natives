import { truncateLine, escapeRegex } from "./shared/utils";
import type { ContextLine, GrepOutputMode } from "./ripgrep";

// ── Types ───────────────────────────────────────────────────────────

export interface SearchOptions {
	/** Regex pattern to search for. */
	pattern: string;
	/** Case-insensitive search. */
	ignoreCase?: boolean;
	/** Enable multiline matching. */
	multiline?: boolean;
	/** Maximum number of matches to return. */
	maxCount?: number;
	/** Skip first N matches. */
	offset?: number;
	/** Lines of context before matches. */
	contextBefore?: number;
	/** Lines of context after matches. */
	contextAfter?: number;
	/** Lines of context before/after matches (legacy). */
	context?: number;
	/** Truncate lines longer than this (characters). */
	maxColumns?: number;
	/** Output mode (content or count). */
	mode?: GrepOutputMode;
}

export interface Match {
	/** 1-indexed line number. */
	lineNumber: number;
	/** The matched line content. */
	line: string;
	/** Context lines before the match. */
	contextBefore?: ContextLine[];
	/** Context lines after the match. */
	contextAfter?: ContextLine[];
}

export interface SearchResult {
	/** All matches found. */
	matches: Match[];
	/** Total number of matches (may exceed `matches.length` due to offset/limit). */
	matchCount: number;
	/** Whether the limit was reached. */
	limitReached: boolean;
	/** Error message, if any. */
	error?: string;
}

// ── Main search function ───────────────────────────────────────────

export function searchContent(content: string, options: SearchOptions): SearchResult {
	const {
		pattern,
		ignoreCase,
		multiline,
		maxCount,
		offset = 0,
		contextBefore: ctxBefore,
		contextAfter: ctxAfter,
		context: ctxLegacy,
		maxColumns,
		mode = "content",
	} = options;

	if (!pattern) {
		return { matches: [], matchCount: 0, limitReached: false };
	}

	const contextBefore = ctxBefore ?? ctxLegacy ?? 0;
	const contextAfter = ctxAfter ?? ctxLegacy ?? 0;

	try {
		if (mode === "count") {
			return searchCount(content, pattern, ignoreCase, multiline);
		}

		return searchContentMode(content, pattern, {
			ignoreCase,
			multiline,
			maxCount,
			offset,
			contextBefore,
			contextAfter,
			maxColumns,
		});
	} catch (err) {
		return {
			matches: [],
			matchCount: 0,
			limitReached: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// ── Build regex ────────────────────────────────────────────────────

function buildRegex(pattern: string, ignoreCase?: boolean, multiline?: boolean): RegExp {
	let flags = "g";
	if (ignoreCase) flags += "i";
	// For multiline, use s flag (dotAll) so . matches newlines for across-line matching
	if (multiline) flags += "s";
	try {
		return new RegExp(pattern, flags);
	} catch {
		// If the pattern is not a valid regex, escape and treat as literal
		return new RegExp(escapeRegex(pattern), flags);
	}
}

// ── Count mode ─────────────────────────────────────────────────────

function searchCount(
	content: string,
	pattern: string,
	ignoreCase?: boolean,
	multiline?: boolean,
): SearchResult {
	const regex = buildRegex(pattern, ignoreCase, multiline);
	// For count mode, we match globally and count occurrences
	const matches = content.match(regex);
	const count = matches ? matches.length : 0;
	return {
		matches: [],
		matchCount: count,
		limitReached: false,
	};
}

// ── Content mode ───────────────────────────────────────────────────

function searchContentMode(
	content: string,
	pattern: string,
	opts: {
		ignoreCase?: boolean;
		multiline?: boolean;
		maxCount?: number;
		offset: number;
		contextBefore: number;
		contextAfter: number;
		maxColumns?: number;
	},
): SearchResult {
	const { ignoreCase, multiline, maxCount, offset, contextBefore, contextAfter, maxColumns } = opts;

	// Split content into lines
	const lines = content.split(/\r?\n/);

	const results: Match[] = [];
	let actualMatchCount = 0;
	let limitReached = false;

	if (multiline) {
		// For multiline, search across the whole content, converting match positions
		// back to line numbers.
		const regex = buildRegex(pattern, ignoreCase, multiline);
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) !== null) {
			actualMatchCount++;

			// Handle offset (skip)
			if (offset > 0 && actualMatchCount <= offset) continue;

			// Handle maxCount
			if (maxCount !== undefined && results.length >= maxCount) {
				limitReached = true;
				break;
			}

			const matchText = match[0];
			const matchStart = match.index;

			// Convert character position to line number (0-based line index)
			let lineIdx = 0;
			let charPos = 0;
			for (let i = 0; i < lines.length; i++) {
				if (charPos + lines[i].length + (i < lines.length - 1 ? 1 : 0) > matchStart) {
					lineIdx = i;
					break;
				}
				charPos += lines[i].length + 1; // +1 for newline
				lineIdx = i + 1;
			}

			// Count how many lines the match spans
			const consumedLines = matchText.split(/\r?\n/).length;

			// Get context lines
			const ctxBeforeList: ContextLine[] = [];
			for (let c = Math.max(0, lineIdx - contextBefore); c < lineIdx; c++) {
				ctxBeforeList.push({
					lineNumber: c + 1,
					line: truncateLine(lines[c], maxColumns),
				});
			}

			const ctxAfterList: ContextLine[] = [];
			const afterStart = lineIdx + consumedLines;
			for (let c = afterStart; c < Math.min(lines.length, afterStart + contextAfter); c++) {
				ctxAfterList.push({
					lineNumber: c + 1,
					line: truncateLine(lines[c], maxColumns),
				});
			}

			results.push({
				lineNumber: lineIdx + 1,
				line: truncateLine(matchText.replace(/\n/g, "\\n"), maxColumns),
				contextBefore: ctxBeforeList.length > 0 ? ctxBeforeList : undefined,
				contextAfter: ctxAfterList.length > 0 ? ctxAfterList : undefined,
			});
		}

		return { matches: results, matchCount: actualMatchCount, limitReached };
	}

	// Single-line mode: test each line individually
	const regex = buildRegex(pattern, ignoreCase, false);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		regex.lastIndex = 0;
		if (!regex.test(line)) continue;

		actualMatchCount++;

		// Handle offset
		if (offset > 0 && actualMatchCount <= offset) continue;

		// Handle maxCount
		if (maxCount !== undefined && results.length >= maxCount) {
			limitReached = true;
			break;
		}

		// Get context lines
		const ctxBeforeList: ContextLine[] = [];
		for (let c = Math.max(0, i - contextBefore); c < i; c++) {
			ctxBeforeList.push({
				lineNumber: c + 1,
				line: truncateLine(lines[c], maxColumns),
			});
		}

		const ctxAfterList: ContextLine[] = [];
		for (let c = i + 1; c < Math.min(lines.length, i + 1 + contextAfter); c++) {
			ctxAfterList.push({
				lineNumber: c + 1,
				line: truncateLine(lines[c], maxColumns),
			});
		}

		results.push({
			lineNumber: i + 1,
			line: truncateLine(line, maxColumns),
			contextBefore: ctxBeforeList.length > 0 ? ctxBeforeList : undefined,
			contextAfter: ctxAfterList.length > 0 ? ctxAfterList : undefined,
		});
	}

	return {
		matches: results,
		matchCount: actualMatchCount,
		limitReached,
	};
}


