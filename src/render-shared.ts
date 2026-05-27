/**
 * Shared rendering utilities for all pi-sherlock tools.
 *
 * Eliminates ~150 duplicated lines across 5 render files.
 * Each tool render file now only defines its own types and delegates
 * to these shared functions for common patterns.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

// ── Icons ───────────────────────────────────────────────────────────

export const ICONS = {
	pending: "\u25CB",
	success: "\u2713",
	error: "\u2717",
	warning: "\u26A0",
} as const;

// ── Line helpers ────────────────────────────────────────────────────

export function line(theme: Theme, color: string, text: string): string {
	return theme.fg(color as any, text);
}

/**
 * Build a consistent status line:
 *   ○ **Tool Name** description [meta]
 */
export function statusLine(
	theme: Theme,
	icon: string,
	title: string,
	meta?: string,
	description?: string,
): string {
	let result = `${icon} ${theme.bold(title)}`;
	if (description) result += ` ${line(theme, "muted", description)}`;
	if (meta) result += ` ${line(theme, "dim", `[${meta}]`)}`;
	return result;
}

// ── Result rendering helpers ────────────────────────────────────────

/**
 * Extract text content from a tool result as a fallback when details
 * are missing. This identical pattern existed 5 times across render files.
 */
export function fallbackText(
	result: AgentToolResult<any>,
	defaultText: string,
): string {
	const text = result.content
		?.filter((c: any) => c.type === "text")
		.map((c: any) => c.text)
		.join("\n");
	return text || defaultText;
}

/**
 * Singular/plural helper. Returns "X" or "Xs" based on count.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
	return `${count} ${count !== 1 ? (plural ?? singular + "s") : singular}`;
}

// ── Generic call renderer ───────────────────────────────────────────

/**
 * Render a pending tool call with a standard status line.
 * Most tools can use this directly instead of writing their own renderCall.
 */
export function renderCall(
	toolLabel: string,
	description: string,
	meta: string | undefined,
	theme: Theme,
): Component {
	return new Text(statusLine(theme, ICONS.pending, toolLabel, meta, description), 0, 0);
}

// ── Generic result renderer builder ─────────────────────────────────

export interface ResultRenderConfig<TDetails extends { result?: string }> {
	/** Tool label shown in status line (e.g., "Grep", "Fzf"). */
	label: string;
	/** Extract the query/description string from details. */
	getQuery: (details: TDetails) => string;
	/** Build metadata string from details (e.g., "3 matches, 2 files"). */
	getMeta: (details: TDetails) => string[];
	/** Determine which icon to show (success or warning). */
	getIcon: (details: TDetails) => string;
	/** Optional: override the status-line label for special cases. */
	getTitle?: (details: TDetails) => string;
	/** Optional: colorize the result body. */
	colorResult?: (details: TDetails, theme: Theme) => string | undefined;
	/** Human-readable outcome shown before raw evidence. */
	getSummary?: (details: TDetails) => string;
	/** Short, high-signal findings shown in collapsed view. */
	getHighlights?: (details: TDetails) => string[];
	/** Supporting details shown before raw output in expanded view. */
	getEvidence?: (details: TDetails) => string[];
	/** Warnings, fallbacks, truncation, or caveats. */
	getDiagnostics?: (details: TDetails) => string[];
	/** Raw or machine-oriented payload shown only in expanded view. Defaults to details.result. */
	getRaw?: (details: TDetails) => string | undefined;
	/** Label for the expanded raw payload section. */
	rawLabel?: string;
}

/**
 * Build a standard renderResult function for a tool.
 * Handles the common pattern of: fallback text → error display → status line + results.
 */
function pushSection(lines: string[], title: string, entries: string[] | undefined, theme: Theme): void {
	const clean = (entries ?? []).filter(Boolean);
	if (clean.length === 0) return;
	lines.push("");
	lines.push(line(theme, "muted", title));
	for (const entry of clean) {
		lines.push(`  ${entry}`);
	}
}

function firstLines(text: string | undefined, maxLines: number): string[] {
	if (!text) return [];
	const lines = text.split("\n").filter(l => l.trim().length > 0);
	return lines.slice(0, maxLines);
}

export function renderResult<TDetails extends { result?: string }>(
	result: AgentToolResult<TDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	config: ResultRenderConfig<TDetails>,
): Component {
	// Fallback when details are missing
	if (!result.details) {
		return new Text(fallbackText(result, `${config.label} completed`), 0, 0);
	}

	const { details } = result;

	// Error state
	if (result.isError) {
		const errorText = details.result || fallbackText(result, `${config.label} failed`);
		const text = [
			statusLine(theme, ICONS.error, config.label, undefined, config.getQuery(details)),
			`\n${line(theme, "error", errorText)}`,
		].join("");
		return new Text(text, 0, 0);
	}

	// Success state
	const meta = config.getMeta(details).filter(Boolean).join(", ");
	const icon = config.getIcon(details);
	const title = config.getTitle ? config.getTitle(details) : config.label;
	const summary = config.getSummary?.(details);
	const highlights = config.getHighlights?.(details);
	const diagnostics = config.getDiagnostics?.(details);
	const evidence = config.getEvidence?.(details);
	const raw = config.getRaw ? config.getRaw(details) : details.result;
	const coloredRaw = raw && config.colorResult ? config.colorResult(details, theme) : raw;

	const lines = [statusLine(theme, icon, title, meta || undefined, config.getQuery(details))];

	if (summary) {
		lines.push(summary);
	}

	if (config.getSummary || config.getHighlights || config.getEvidence || config.getDiagnostics || config.getRaw) {
		pushSection(lines, "Highlights", highlights, theme);
		if (options.expanded) {
			pushSection(lines, "Evidence", evidence, theme);
			pushSection(lines, "Diagnostics", diagnostics, theme);
			if (raw) {
				lines.push("");
				lines.push(line(theme, "muted", config.rawLabel ?? "Raw output"));
				lines.push(coloredRaw ?? raw);
			}
		} else {
			const collapsedDiagnostics = diagnostics?.slice(0, 2);
			pushSection(lines, "Diagnostics", collapsedDiagnostics, theme);
			if (raw && raw.trim().length > 0) {
				lines.push(line(theme, "dim", "(Ctrl+O to expand raw output and full evidence)"));
			}
		}
		return new Text(lines.join("\n"), 0, 0);
	}

	const text = [
		statusLine(theme, icon, title, meta || undefined, config.getQuery(details)),
		details.result ? `\n${coloredRaw ?? details.result}` : "",
	].join("");

	return new Text(text, 0, 0);
}

export { firstLines };
