/**
 * Render functions for the `ripgrep` (advanced) tool.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import {
	ICONS,
	statusLine,
	renderResult,
	type ResultRenderConfig,
} from "./render-shared";
import type { GrepOutputMode } from "./ripgrep";

// ── Types ──────────────────────────────────────────────────────────

export interface RipgrepSearchParams {
	pattern: string;
	path?: string;
	glob?: string;
	type?: string;
	ignoreCase?: boolean;
	multiline?: boolean;
	hidden?: boolean;
	noIgnore?: boolean;
	mode?: GrepOutputMode;
	contextBefore?: number;
	contextAfter?: number;
	maxCount?: number;
	skip?: number;
	fixedStrings?: boolean;
	timeoutMs?: number;
	maxColumns?: number;
}

export interface RipgrepSearchDetails {
	pattern: string;
	path: string;
	mode: GrepOutputMode;
	matchCount: number;
	fileCount: number;
	filesSearched: number;
	limitReached?: boolean;
	result: string;
}

// ── Call renderer ──────────────────────────────────────────────────

export function renderRipgrepCall(
	params: RipgrepSearchParams,
	theme: Theme,
	_context: ToolRenderContext<any, RipgrepSearchParams>,
): Component {
	const query = params.pattern || "";
	const modeLabel = params.mode && params.mode !== "content" ? params.mode : undefined;
	const meta = [params.ignoreCase ? "i" : undefined, params.multiline ? "multiline" : undefined, modeLabel]
		.filter(Boolean)
		.join("/");
	const pathInfo = params.path ? ` in ${params.path}` : "";
	return new Text(statusLine(theme, ICONS.pending, "Ripgrep", meta || undefined, `${query}${pathInfo}`), 0, 0);
}

// ── Result renderer ────────────────────────────────────────────────

const ripgrepResultConfig: ResultRenderConfig<RipgrepSearchDetails> = {
	label: "Ripgrep",
	getQuery: d => d.pattern,
	getMeta: d => {
		const meta = [
			`${d.matchCount} match${d.matchCount !== 1 ? "es" : ""}`,
			`${d.fileCount} file${d.fileCount !== 1 ? "s" : ""}`,
			`${d.filesSearched} searched`,
		];
		if (d.mode && d.mode !== "content") meta.push(d.mode);
		return meta;
	},
	getIcon: d => d.matchCount > 0 ? ICONS.success : ICONS.warning,
	getTitle: d => {
		const modeLabel = d.mode !== "content" ? ` (${d.mode})` : "";
		return `Ripgrep${modeLabel}`;
	},
};

export function renderRipgrepResult(
	result: AgentToolResult<RipgrepSearchDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, RipgrepSearchParams>,
): Component {
	return renderResult(result, options, theme, ripgrepResultConfig);
}
