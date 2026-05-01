/**
 * Render functions for the `fd` tool.
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
import type { FdFileType } from "./fd";

// ── Types ──────────────────────────────────────────────────────────

export interface FdFindParams {
	pattern?: string;
	path?: string;
	glob?: string;
	extension?: string;
	type?: FdFileType;
	hidden?: boolean;
	noIgnore?: boolean;
	maxResults?: number;
	caseSensitive?: boolean;
}

export interface FdFindDetails {
	query: string;
	matchCount: number;
	limitReached: boolean;
	result: string;
}

// ── Call renderer ──────────────────────────────────────────────────

export function renderFdCall(
	params: FdFindParams,
	theme: Theme,
	_context: ToolRenderContext<any, FdFindParams>,
): Component {
	const parts: string[] = [];
	if (params.pattern) parts.push(params.pattern);
	if (params.glob) parts.push(`glob:${params.glob}`);
	if (params.extension) parts.push(`.${params.extension}`);
	if (params.type) parts.push(`type:${params.type}`);

	const description = parts.join(" / ") || "all files";
	const meta = params.hidden ? "hidden" : undefined;
	const pathInfo = params.path ? ` in ${params.path}` : "";
	return new Text(statusLine(theme, ICONS.pending, "Find Files", meta, `${description}${pathInfo}`), 0, 0);
}

// ── Result renderer ────────────────────────────────────────────────

const fdResultConfig: ResultRenderConfig<FdFindDetails> = {
	label: "Find Files",
	getQuery: d => d.query,
	getMeta: d => {
		const meta = [`${d.matchCount} result${d.matchCount !== 1 ? "s" : ""}`];
		if (d.limitReached) meta.push("truncated");
		return meta;
	},
	getIcon: d => d.matchCount > 0 ? ICONS.success : ICONS.warning,
};

export function renderFdResult(
	result: AgentToolResult<FdFindDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, FdFindParams>,
): Component {
	return renderResult(result, options, theme, fdResultConfig);
}
