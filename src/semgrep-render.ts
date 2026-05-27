/**
 * Render functions for the `semgrep` tool.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import {
	ICONS,
	line,
	statusLine,
	renderResult,
	firstLines,
	type ResultRenderConfig,
} from "./render-shared";
import type { SemgrepSeverity } from "./semgrep";

// ── Types ──────────────────────────────────────────────────────────

export interface SemgrepScanParams {
	pattern?: string;
	config?: string;
	path?: string;
	language?: string;
	severity?: SemgrepSeverity;
}

export interface SemgrepScanDetails {
	query: string;
	mode: "pattern" | "config" | "auto";
	matchCount: number;
	fileCount: number;
	filesScanned: number;
	severity?: SemgrepSeverity;
	result: string;
}

// ── Call renderer ──────────────────────────────────────────────────

export function renderSemgrepCall(
	params: SemgrepScanParams,
	theme: Theme,
	_context: ToolRenderContext<any, SemgrepScanParams>,
): Component {
	let description: string;
	let meta: string | undefined;

	if (params.pattern) {
		description = params.pattern;
		meta = `pattern${params.language ? ` / ${params.language}` : ""}`;
	} else if (params.config) {
		description = params.config;
		meta = "config";
	} else {
		description = "auto";
		meta = "config:auto";
	}

	if (params.severity) {
		meta = meta ? `${meta} / >=${params.severity}` : `>=${params.severity}`;
	}

	const pathInfo = params.path ? ` in ${params.path}` : "";
	return new Text(statusLine(theme, ICONS.pending, "Semgrep", meta, `${description}${pathInfo}`), 0, 0);
}

// ── Result renderer ────────────────────────────────────────────────

const semgrepResultConfig: ResultRenderConfig<SemgrepScanDetails> = {
	label: "Semgrep",
	getQuery: d => d.query,
	getMeta: d => {
		const meta = [
			`${d.matchCount} finding${d.matchCount !== 1 ? "s" : ""}`,
			`${d.fileCount} file${d.fileCount !== 1 ? "s" : ""}`,
			`${d.filesScanned} scanned`,
		];
		if (d.severity) meta.push(`>=${d.severity}`);
		return meta;
	},
	getIcon: d => d.matchCount > 0 ? ICONS.warning : ICONS.success,
	getTitle: d => {
		const modeLabel = d.mode === "pattern" ? "Pattern" : d.mode === "config" ? "Config" : "Auto";
		return `Semgrep (${modeLabel})`;
	},
	getSummary: d =>
		`Scanned ${d.filesScanned} file${d.filesScanned !== 1 ? "s" : ""} with Semgrep and found ${d.matchCount} finding${d.matchCount !== 1 ? "s" : ""} in ${d.fileCount} file${d.fileCount !== 1 ? "s" : ""}.`,
	getHighlights: d => firstLines(d.result, 8),
	getRaw: d => d.result,
	rawLabel: "Semgrep findings",
	colorResult: (d, theme) => {
		const color = d.matchCount > 10 ? "error" : d.matchCount > 0 ? "warning" : "success";
		return theme.fg(color as any, d.result);
	},
};

export function renderSemgrepResult(
	result: AgentToolResult<SemgrepScanDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, SemgrepScanParams>,
): Component {
	return renderResult(result, options, theme, semgrepResultConfig);
}
