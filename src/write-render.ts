/**
 * Rendering helpers for `write_enhanced` results.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

import type { BunWriteResult } from "./bun-writer.ts";
import { ICONS, statusLine, renderResult, type ResultRenderConfig } from "./render-shared.ts";

export interface WriteEnhancedParams {
	path: string;
	content: string;
	mode?: "write" | "append";
	atomic?: boolean;
	backup?: boolean;
	streaming?: boolean;
}

export interface WriteEnhancedDetails extends BunWriteResult {
	path: string;
	resolvedPath: string;
}

export function formatWriteEnhancedBlock(details: WriteEnhancedDetails, relPath: string): string {
	const lines = [
		`path: ${relPath}`,
		`resolved: ${details.resolvedPath}`,
		`method: ${details.method}`,
		`atomic: ${details.atomic}`,
		`bytesWritten: ${details.bytesWritten}`,
		`writeTime: ${details.writeTime.toFixed(3)}`,
	];
	if (details.backupPath) {
		lines.push(`backup: ${details.backupPath}`);
	}
	return `${lines.join("\n")}\n---\nwrote successfully`;
}

const writeEnhancedResultConfig: ResultRenderConfig<WriteEnhancedDetails> = {
	label: "Enhanced Write",
	getQuery: d => d.path,
	getMeta: d =>
		[
			d.method,
			`${d.bytesWritten} B`,
			`${d.writeTime.toFixed(2)} ms`,
			d.backupPath ? "backup" : "",
		].filter(Boolean),
	getIcon: _d => ICONS.success,
	getSummary: d =>
		`Wrote ${d.bytesWritten} byte${d.bytesWritten !== 1 ? "s" : ""} to ${d.path} using ${d.atomic ? "atomic" : "direct"} write mode.`,
	getHighlights: d => [
		`target: ${d.path}`,
		`method: ${d.method}`,
		d.backupPath ? `backup created: ${d.backupPath}` : "backup not requested or not created",
	],
	getEvidence: d => [
		`resolved path: ${d.resolvedPath}`,
		`write time: ${d.writeTime.toFixed(3)} ms`,
		`atomic write: ${d.atomic ? "yes" : "no"}`,
	],
	getRaw: d => formatWriteEnhancedBlock(d, d.path),
	rawLabel: "Write details",
};

export function renderWriteEnhancedCall(
	params: WriteEnhancedParams,
	theme: Theme,
	_context: ToolRenderContext<any, WriteEnhancedParams>,
): Component {
	const bits = [
		params.mode === "append" ? "append" : undefined,
		params.atomic === false ? "non-atomic" : undefined,
		params.backup ? "backup" : undefined,
		params.streaming ? "stream" : undefined,
	].filter(Boolean);
	const meta = bits.length ? bits.join(", ") : undefined;
	return new Text(statusLine(theme, ICONS.pending, "Enhanced Write", meta, params.path), 0, 0);
}

export function renderWriteEnhancedResult(
	result: AgentToolResult<WriteEnhancedDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, WriteEnhancedParams>,
): Component {
	return renderResult(result, options, theme, writeEnhancedResultConfig);
}
