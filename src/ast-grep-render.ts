/**
 * Render functions for the `ast-grep` tool.
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

export interface AstGrepSearchParams {
	pattern: string;
	language?: string;
	path?: string;
	rewrite?: string;
	strictness?: "cst" | "smart" | "ast" | "relaxed" | "signature" | "template";
	follow?: boolean;
}

export interface AstGrepSearchDetails {
	query: string;
	language?: string;
	matchCount: number;
	filesScanned: number;
	warningCount: number;
	result: string;
}

// ── Call renderer ──────────────────────────────────────────────────

export function renderAstGrepCall(
	params: AstGrepSearchParams,
	theme: Theme,
	_context: ToolRenderContext<any, AstGrepSearchParams>,
): Component {
	const query = params.pattern || "";
	const langLabel = params.language ?? "auto";
	const meta = [
		`lang:${langLabel}`,
		params.strictness ? `strict:${params.strictness}` : undefined,
		params.rewrite ? "rewrite" : undefined,
	].filter(Boolean).join(" / ");
	const pathInfo = params.path ? ` in ${params.path}` : "";
	return new Text(statusLine(theme, ICONS.pending, "ast-grep", meta || undefined, `${query}${pathInfo}`), 0, 0);
}

// ── Result renderer ────────────────────────────────────────────────

const astGrepResultConfig: ResultRenderConfig<AstGrepSearchDetails> = {
	label: "ast-grep",
	getQuery: d => d.language ? `[${d.language}] ${d.query}` : d.query,
	getMeta: d => {
		const meta = [
			`${d.matchCount} match${d.matchCount !== 1 ? "es" : ""}`,
			`${d.filesScanned} file${d.filesScanned !== 1 ? "s" : ""} scanned`,
		];
		if (d.warningCount > 0) meta.push(`${d.warningCount} warning${d.warningCount !== 1 ? "s" : ""}`);
		return meta;
	},
	getIcon: d => d.matchCount > 0 ? ICONS.success : ICONS.warning,
	getSummary: d =>
		`Structural search${d.language ? ` for ${d.language}` : ""} found ${d.matchCount} match${d.matchCount !== 1 ? "es" : ""} after scanning ${d.filesScanned} file${d.filesScanned !== 1 ? "s" : ""}.`,
	getHighlights: d => firstLines(d.result, 8),
	getDiagnostics: d => d.warningCount > 0 ? [`${d.warningCount} warning${d.warningCount !== 1 ? "s" : ""}; expand for full warning text.`] : [],
	getRaw: d => d.result,
	rawLabel: "Structural matches",
};

export function renderAstGrepResult(
	result: AgentToolResult<AstGrepSearchDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, AstGrepSearchParams>,
): Component {
	return renderResult(result, options, theme, astGrepResultConfig);
}
