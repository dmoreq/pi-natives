/**
 * Render functions for the `jscpd` tool.
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

export interface JscpdDetectParams {
	paths?: string[];
	minLines?: number;
	minTokens?: number;
	mode?: "strict" | "mild" | "weak";
	ignore?: string[];
	format?: string[];
}

export interface JscpdDetectDetails {
	query: string;
	mode: string;
	totalClones: number;
	totalDuplicatedLines: number;
	percentage: number;
	totalSources: number;
	result: string;
}

// ── Call renderer ──────────────────────────────────────────────────

export function renderJscpdCall(
	params: JscpdDetectParams,
	theme: Theme,
	_context: ToolRenderContext<any, JscpdDetectParams>,
): Component {
	const pathInfo = params.paths && params.paths.length > 0
		? params.paths.join(", ")
		: ".";
	const meta = [
		params.mode ? `mode:${params.mode}` : undefined,
		params.minLines ? `min:${params.minLines}l` : undefined,
		params.format ? params.format.join(",") : undefined,
	].filter(Boolean).join(", ");
	return new Text(statusLine(theme, ICONS.pending, "Find Duplicates", meta || undefined, pathInfo), 0, 0);
}

// ── Result renderer ────────────────────────────────────────────────

const jscpdResultConfig: ResultRenderConfig<JscpdDetectDetails> = {
	label: "Find Duplicates",
	getQuery: d => d.query,
	getMeta: d => {
		const meta = [
			`${d.totalClones} clone${d.totalClones !== 1 ? "s" : ""}`,
			`${d.totalDuplicatedLines} dup line${d.totalDuplicatedLines !== 1 ? "s" : ""}`,
			`${d.percentage.toFixed(1)}% of codebase`,
			`${d.totalSources} file${d.totalSources !== 1 ? "s" : ""}`,
			`mode:${d.mode}`,
		];
		return meta;
	},
	getIcon: d => d.totalClones > 0 ? ICONS.warning : ICONS.success,
};

export function renderJscpdResult(
	result: AgentToolResult<JscpdDetectDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, JscpdDetectParams>,
): Component {
	return renderResult(result, options, theme, jscpdResultConfig);
}
