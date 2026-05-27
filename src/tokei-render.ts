/**
 * Render functions for the `tokei` tool.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import {
	ICONS,
	statusLine,
	renderResult,
	firstLines,
	type ResultRenderConfig,
} from "./render-shared";

// ── Types ──────────────────────────────────────────────────────────

export interface TokeiCountParams {
	paths?: string[];
	files?: boolean;
	exclude?: string[];
	hidden?: boolean;
	noIgnore?: boolean;
	types?: string[];
	sort?: "files" | "lines" | "blanks" | "code" | "comments";
	reverseSort?: boolean;
}

export interface TokeiCountDetails {
	paths: string;
	languageCount: number;
	totalFiles: number;
	totalLines: number;
	totalCode: number;
	totalComments: number;
	totalBlanks: number;
	result: string;
}

// ── Call renderer ──────────────────────────────────────────────────

export function renderTokeiCall(
	params: TokeiCountParams,
	theme: Theme,
	_context: ToolRenderContext<any, TokeiCountParams>,
): Component {
	const pathInfo = params.paths && params.paths.length > 0
		? params.paths.join(", ")
		: ".";
	const meta = [
		params.files ? "per-file" : undefined,
		params.types && params.types.length > 0 ? params.types.join(",") : undefined,
		params.hidden ? "hidden" : undefined,
	].filter(Boolean).join(", ");
	return new Text(statusLine(theme, ICONS.pending, "Count Lines", meta || undefined, pathInfo), 0, 0);
}

// ── Result renderer ────────────────────────────────────────────────

const tokeiResultConfig: ResultRenderConfig<TokeiCountDetails> = {
	label: "Count Lines",
	getQuery: d => d.paths,
	getMeta: d => [
		`${d.languageCount} language${d.languageCount !== 1 ? "s" : ""}`,
		`${d.totalFiles} file${d.totalFiles !== 1 ? "s" : ""}`,
		`${d.totalLines} line${d.totalLines !== 1 ? "s" : ""} (${d.totalCode} code, ${d.totalComments} comment${d.totalComments !== 1 ? "s" : ""}, ${d.totalBlanks} blank${d.totalBlanks !== 1 ? "s" : ""})`,
	],
	getIcon: _d => ICONS.success,
	getSummary: d =>
		`Counted ${d.totalLines} line${d.totalLines !== 1 ? "s" : ""} across ${d.totalFiles} file${d.totalFiles !== 1 ? "s" : ""} and ${d.languageCount} language${d.languageCount !== 1 ? "s" : ""}.`,
	getHighlights: d => firstLines(d.result, 10),
	getRaw: d => d.result,
	rawLabel: "Line count table",
};

export function renderTokeiResult(
	result: AgentToolResult<TokeiCountDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, TokeiCountParams>,
): Component {
	return renderResult(result, options, theme, tokeiResultConfig);
}
