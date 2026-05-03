/**
 * Output size validation and truncation.
 *
 * All pi-sherlock tool outputs are passed through this module before being
 * returned to the LLM. This prevents excessively large outputs from consuming
 * too many tokens and ensures the agent always sees manageable results.
 *
 * Usage (in any tool's execute()):
 *   import { withOutputTruncation } from "../shared/truncate";
 *   return withOutputTruncation({ text: resultText, details });
 */

// ── Default thresholds ─────────────────────────────────────────────

/**
 * Maximum characters in a result text before truncation kicks in.
 * ~10K chars ≈ ~2500-3000 tokens, which is a reasonable ceiling for
 * any single tool invocation.
 */
export const DEFAULT_MAX_CHARS = 10_000;

/**
 * Maximum lines in a result text before truncation kicks in.
 * Applied first (cheaper to check) before character-level truncation.
 */
export const DEFAULT_MAX_LINES = 200;

// ── Truncation result ──────────────────────────────────────────────

export interface TruncationInfo {
	/** Whether truncation occurred. */
	truncated: boolean;
	/** Original length before truncation (characters). */
	originalLength: number;
	/** Original line count before truncation. */
	originalLines: number;
	/** Length after truncation (characters). */
	finalLength: number;
}

// ── Core truncation function ───────────────────────────────────────

/**
 * Truncate text to fit within `maxChars` characters and `maxLines` lines.
 *
 * Strategy:
 * 1. First cap by line count (keeps first N lines).
 * 2. Then cap by character count on the remaining text.
 * 3. Append a diagnostic note so the agent knows data was suppressed.
 *
 * Returns the truncated text (or original if within limits) plus metadata.
 */
export function truncateOutput(
	text: string | null | undefined,
	maxChars: number = DEFAULT_MAX_CHARS,
	maxLines: number = DEFAULT_MAX_LINES,
): { text: string; truncated: boolean; originalLength: number; originalLines: number } {
	if (!text) {
		return { text: "", truncated: false, originalLength: 0, originalLines: 0 };
	}

	const originalLength = text.length;
	const originalLines = text.split("\n").length;

	// Both thresholds satisfied → no truncation needed
	if (originalLength <= maxChars && originalLines <= maxLines) {
		return { text, truncated: false, originalLength, originalLines };
	}

	// Apply line cap first
	let truncated = text;
	let linesTruncated = false;
	let suppressedLines = 0;

	if (originalLines > maxLines) {
		const lines = text.split("\n");
		suppressedLines = lines.length - maxLines;
		truncated = lines.slice(0, maxLines).join("\n");
		linesTruncated = true;
	}

	// Then apply character cap
	let charsTruncated = false;
	let suppressedChars = 0;

	if (truncated.length > maxChars) {
		suppressedChars = truncated.length - maxChars;
		truncated = truncated.slice(0, maxChars);
		charsTruncated = true;
	}

	// Build diagnostic note
	const notes: string[] = [];
	if (linesTruncated) notes.push(`showed ${maxLines}/${originalLines} lines`);
	if (charsTruncated) notes.push(`showed ${maxChars.toLocaleString()}/${originalLength.toLocaleString()} chars`);

	const finalText = linesTruncated || charsTruncated
		? `${truncated}\n\n---\n(truncated: ${notes.join(", ")})`
		: truncated;

	return {
		text: finalText,
		truncated: linesTruncated || charsTruncated,
		originalLength,
		originalLines,
	};
}

// ── Tool output wrapper ────────────────────────────────────────────

/**
 * Wrap a tool's result with output truncation.
 *
 * Call this at the end of every tool's execute() function, just before
 * the return statement.
 *
 * @example
 *   return withOutputTruncation({ text: resultText, details });
 *
 * If the result is already an error (isError), truncation is skipped.
 *
 * @param result - The tool result { text, details } from executeSafe.
 * @param maxChars - Optional per-tool override for max characters.
 * @param maxLines - Optional per-tool override for max lines.
 * @returns The same shape with text potentially truncated.
 */
export function withOutputTruncation<
	TDetails extends { result?: string } & Record<string, unknown>,
>(
	result: { text: string; details: TDetails },
	maxChars?: number,
	maxLines?: number,
): { text: string; details: TDetails } {
	const { text, details } = result;

	const { text: truncatedText, truncated } = truncateOutput(
		text,
		maxChars ?? DEFAULT_MAX_CHARS,
		maxLines ?? DEFAULT_MAX_LINES,
	);

	// Update details.result to match (if present)
	if (truncated && details.result !== undefined) {
		return {
			text: truncatedText,
			details: {
				...details,
				result: truncatedText,
			},
		};
	}

	return {
		text: truncatedText,
		details,
	};
}
