/**
 * Shared tool execution utilities.
 *
 * Provides error-handling wrappers and result builders to eliminate
 * the 5x duplicated try/catch pattern in tool execute() functions.
 */
import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import { PiNativeError } from "../shared/errors.ts";

// ── Result builder ──────────────────────────────────────────────────

export function makeResult<T>(text: string, details: T, isError?: boolean): AgentToolResult<T> {
	return {
		content: [{ type: "text" as const, text }],
		details,
		isError,
	};
}

// ── Execution wrapper ───────────────────────────────────────────────

/**
 * Wraps a tool execution function with standard error handling.
 *
 * Instead of each tool repeating:
 *   try { ... } catch (err) {
 *     const errorMsg = err instanceof XxxError ? err.message : `Tool failed: ${err}`;
 *     const details = { ... empty details ... };
 *     return makeResult(errorMsg, details, true);
 *   }
 *
 * Tools now write: executeSafe(params, ctx, async () => { ... core logic ... })
 */
export async function executeSafe<TParams, TDetails extends Record<string, unknown>>(
	errorLabel: string,
	buildDetails: () => TDetails,
	fn: () => Promise<{ text: string; details: TDetails }>,
): Promise<AgentToolResult<TDetails>> {
	try {
		const { text, details } = await fn();
		return makeResult(text, details);
	} catch (err) {
		const errorMsg = err instanceof PiNativeError ? err.message : `${errorLabel} failed: ${err}`;
		return makeResult(errorMsg, buildDetails(), true);
	}
}

// ── Content-mode result formatting (shared by search + ripgrep) ────

import * as path from "node:path";

export interface FormatMatch {
	path: string;
	lineNumber: number;
	line: string;
	contextBefore?: Array<{ lineNumber: number; line: string }>;
	contextAfter?: Array<{ lineNumber: number; line: string }>;
}

/**
 * Format content-mode matches into a human-readable string.
 * Used by both `search` and `ripgrep` tools.
 */
export function formatContentMatches(matches: FormatMatch[], cwd: string): string {
	const formattedLines: string[] = [];
	for (const match of matches) {
		const relPath = path.relative(cwd, match.path);
		const lineStr = match.line.replace(/\t/g, " ");
		if (match.contextBefore && match.contextBefore.length > 0) {
			for (const ctxLine of match.contextBefore) {
				formattedLines.push(`  ${relPath}:${ctxLine.lineNumber} ${ctxLine.line}`);
			}
		}
		formattedLines.push(`* ${relPath}:${match.lineNumber} ${lineStr}`);
		if (match.contextAfter && match.contextAfter.length > 0) {
			for (const ctxLine of match.contextAfter) {
				formattedLines.push(`  ${relPath}:${ctxLine.lineNumber} ${ctxLine.line}`);
			}
		}
	}
	return formattedLines.length > 0 ? formattedLines.join("\n") : "(no matches)";
}
