/**
 * Rendering helpers for enhanced read results (token estimate, formatted output, TUI).
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

import type { EnhancedReadResult } from "./read-router.ts";
import {
	ICONS,
	statusLine,
	renderResult,
	type ResultRenderConfig,
} from "./render-shared.ts";

export { estimateTokens } from "./shared/utils.ts";

// ── Types (tool contract) ────────────────────────────────────────────

export interface ReadEnhancedParams {
	path: string;
	jqQuery?: string;
	yqQuery?: string;
	maxChars?: number;
	maxLines?: number;
}

export interface ReadEnhancedDetails {
	path: string;
	method: string;
	fileType: string;
	codeLanguage?: string;
	dataFormat?: string;
	estimatedTokens: number;
	readTimeMs: number;
	fileSizeBytes: number;
	fallbacks: string[];
	result: string;
}

export function formatEnhancedReadBlock(result: EnhancedReadResult, relPath: string): string {
	const headerLines = [
		`path: ${relPath}`,
		`method: ${result.method}`,
		`fileType: ${result.fileType}`,
		`size: ${result.fileSizeBytes} bytes`,
		`readTimeMs: ${result.readTimeMs}`,
		`estimatedTokens: ${result.estimatedTokens}`,
	];
	if (result.codeLanguage) headerLines.push(`codeLanguage: ${result.codeLanguage}`);
	if (result.dataFormat) headerLines.push(`dataFormat: ${result.dataFormat}`);
	if (result.fallbacks.length > 0) {
		headerLines.push(`fallbacks: ${result.fallbacks.join(", ")}`);
	}

	return `${headerLines.join("\n")}\n---\n${result.content}`;
}

const readEnhancedResultConfig: ResultRenderConfig<ReadEnhancedDetails> = {
	label: "Enhanced Read",
	getQuery: d => d.path,
	getMeta: d => {
		const meta = [`${d.method}`, `${d.fileType}`, `~${d.estimatedTokens} tok`, `${d.readTimeMs} ms`];
		if (d.fallbacks.length > 0) meta.push(`${d.fallbacks.length} fallback`);
		return meta;
	},
	getIcon: _d => ICONS.success,
};

export function renderReadEnhancedCall(
	params: ReadEnhancedParams,
	theme: Theme,
	_context: ToolRenderContext<any, ReadEnhancedParams>,
): Component {
	const bits = [
		params.jqQuery ? `jq:${params.jqQuery}` : undefined,
		params.yqQuery ? `yq:${params.yqQuery}` : undefined,
	].filter(Boolean);
	const meta = bits.length > 0 ? bits.join(" ") : undefined;
	return new Text(statusLine(theme, ICONS.pending, "Enhanced Read", meta, params.path), 0, 0);
}

export function renderReadEnhancedResult(
	result: AgentToolResult<ReadEnhancedDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, ReadEnhancedParams>,
): Component {
	return renderResult(result, options, theme, readEnhancedResultConfig);
}
