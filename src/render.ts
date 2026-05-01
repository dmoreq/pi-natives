/**
 * Render functions for the `search` (Grep) and `concept_search` (BM25) tools.
 *
 * Types are defined here. Rendering delegates to shared utilities.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import {
	ICONS,
	line,
	statusLine,
	renderResult,
	type ResultRenderConfig,
} from "./render-shared";

// ── Grep types ──────────────────────────────────────────────────────

export interface GrepToolParams {
	pattern: string;
	path?: string;
	i?: boolean;
	gitignore?: boolean;
	skip?: number;
	glob?: string;
	type?: string;
	contextBefore?: number;
	contextAfter?: number;
	maxCount?: number;
}

export interface GrepToolDetails {
	query: string;
	path: string;
	matchCount: number;
	fileCount: number;
	filesSearched: number;
	limitReached?: boolean;
	result: string;
}

// ── BM25 types ──────────────────────────────────────────────────────

export interface Bm25ToolParams {
	query: string;
	paths?: string[];
	limit?: number;
}

export interface Bm25ToolDetails {
	query: string;
	matches: Array<{ id: string; score: number; snippet?: string }>;
	totalDocuments: number;
	documentsSearched: number;
	result?: string; // BM25 doesn't use the generic result field the same way
}

// ── Grep call renderer ──────────────────────────────────────────────

export function renderGrepCall(
	params: GrepToolParams,
	theme: Theme,
	_context: ToolRenderContext<any, GrepToolParams>,
): Component {
	const query = params.pattern || "";
	const pathInfo = params.path ? ` in ${params.path}` : "";
	const meta = params.i ? "case-insensitive" : undefined;
	return new Text(statusLine(theme, ICONS.pending, "Grep", meta, `${query}${pathInfo}`), 0, 0);
}

// ── Grep result renderer (uses generic factory) ─────────────────────

const grepResultConfig: ResultRenderConfig<GrepToolDetails> = {
	label: "Grep",
	getQuery: d => d.query || "",
	getMeta: d => {
		const meta = [
			`${d.matchCount} match${d.matchCount !== 1 ? "es" : ""}`,
			`${d.fileCount} file${d.fileCount !== 1 ? "s" : ""}`,
			`${d.filesSearched} searched`,
		];
		if (d.limitReached) meta.push("truncated");
		return meta;
	},
	getIcon: d => d.matchCount > 0 ? ICONS.success : ICONS.warning,
};

export function renderGrepResult(
	result: AgentToolResult<GrepToolDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, GrepToolParams>,
): Component {
	return renderResult(result, options, theme, grepResultConfig);
}

// ── BM25 call renderer ──────────────────────────────────────────────

export function renderBm25Call(
	params: Bm25ToolParams,
	theme: Theme,
	_context: ToolRenderContext<any, Bm25ToolParams>,
): Component {
	const query = params.query || "";
	const meta = params.limit ? `limit:${params.limit}` : undefined;
	return new Text(statusLine(theme, ICONS.pending, "Concept Search (BM25)", meta, query), 0, 0);
}

// ── BM25 result renderer (custom — shows per-match scores) ──────────

export function renderBm25Result(
	result: AgentToolResult<Bm25ToolDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, Bm25ToolParams>,
): Component {
	if (!result.details) {
		const fallback = result.content
			?.filter((c: any) => c.type === "text")
			.map((c: any) => c.text)
			.join("\n");
		return new Text(fallback || "BM25 search completed", 0, 0);
	}

	const { details } = result;
	const meta = [
		`${details.matches.length} match${details.matches.length !== 1 ? "es" : ""}`,
		`${details.documentsSearched} searched`,
	];

	const icon = details.matches.length > 0 ? ICONS.success : ICONS.warning;
	const lines: string[] = [statusLine(theme, icon, "Concept Search (BM25)", meta.join(", "), details.query)];

	if (details.matches.length > 0) {
		for (const match of details.matches) {
			const scoreStr = match.score.toFixed(3);
			const label = match.id.length > 60 ? match.id.slice(0, 60) + "\u2026" : match.id;
			lines.push(`  ${line(theme, "accent", label)} ${line(theme, "dim", `score ${scoreStr}`)}`);
			if (match.snippet && options.expanded) {
				lines.push(`    ${line(theme, "muted", match.snippet)}`);
			}
		}
	} else {
		lines.push(`  ${line(theme, "muted", "No matching results found.")}`);
	}

	return new Text(lines.join("\n"), 0, 0);
}
