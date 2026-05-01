/**
 * Render functions for the `fzf` tool.
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

// ── Types ──────────────────────────────────────────────────────────

export interface FzfSearchParams {
	query: string;
	path?: string;
	glob?: string;
	limit?: number;
}

export interface FzfSearchDetails {
	query: string;
	matchCount: number;
	totalFiles: number;
	limitReached: boolean;
	result: string;
}

// ── Call renderer ──────────────────────────────────────────────────

export function renderFzfCall(
	params: FzfSearchParams,
	theme: Theme,
	_context: ToolRenderContext<any, FzfSearchParams>,
): Component {
	const meta = params.glob ? `glob:${params.glob}` : undefined;
	const pathInfo = params.path ? ` in ${params.path}` : "";
	return new Text(statusLine(theme, ICONS.pending, "Fuzzy Find", meta, `"${params.query}"${pathInfo}`), 0, 0);
}

// ── Result renderer ────────────────────────────────────────────────

const fzfResultConfig: ResultRenderConfig<FzfSearchDetails> = {
	label: "Fuzzy Find",
	getQuery: d => d.query,
	getMeta: d => {
		const meta = [
			`${d.matchCount} match${d.matchCount !== 1 ? "es" : ""}`,
			`${d.totalFiles} files searched`,
		];
		if (d.limitReached) meta.push("truncated");
		return meta;
	},
	getIcon: d => d.matchCount > 0 ? ICONS.success : ICONS.warning,
};

export function renderFzfResult(
	result: AgentToolResult<FzfSearchDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, FzfSearchParams>,
): Component {
	return renderResult(result, options, theme, fzfResultConfig);
}
