/**
 * Rendering helpers for `edit_enhanced` results.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

import type { AstEditResult } from "./ast-editor.ts";
import { ICONS, statusLine, renderResult, type ResultRenderConfig } from "./render-shared.ts";

export interface EditEnhancedParams {
	path: string;
	pattern: string;
	replacement: string;
	preview?: boolean;
	backup?: boolean;
	nodeType?: "function" | "class" | "method" | "variable" | "generic";
	/** Only whole-file (`file`, default) applies; `function` / `class` are reserved — tool output includes a warning when those are passed. */
	scope?: "file" | "function" | "class";
	cwd?: string;
}

export interface EditEnhancedDetails extends AstEditResult {
	path: string;
	resolvedPath: string;
}

export function formatEditEnhancedBlock(details: EditEnhancedDetails, relPath: string): string {
	const lines = [
		`path: ${relPath}`,
		`resolved: ${details.resolvedPath}`,
		`method: ${details.method}`,
		`${details.totalChanges} change(s)`,
		`${details.editTime.toFixed(3)} ms`,
		`syntax_ok: ${details.syntaxValid}`,
	];
	if (details.backupPath) {
		lines.push(`backup: ${details.backupPath}`);
	}
	if (details.warnings && details.warnings.length > 0) {
		lines.push("warnings:");
		for (const w of details.warnings) {
			lines.push(`  - ${w}`);
		}
	}
	let body = lines.join("\n");
	if (details.previewDiff) {
		body += `\n---\n${details.previewDiff}`;
		if (!details.previewDiff.endsWith("\n")) body += "\n";
	}
	return `${body}\n---\nedit complete`;
}

const editEnhancedResultConfig: ResultRenderConfig<EditEnhancedDetails> = {
	label: "Enhanced Edit",
	getQuery: d => d.path,
	getMeta: d =>
		[
			d.method,
			`${d.totalChanges}×`,
			`${d.editTime.toFixed(2)} ms`,
			d.syntaxValid ? "" : "syntax?",
			d.backupPath ? "backup" : "",
		].filter(Boolean),
	getIcon: d => (!d.syntaxValid ? ICONS.warning : ICONS.success),
};

/**
 * Canonical meta chips for pending tool calls (`preview`, effective backup intent, optional `nodeType`).
 * Matches execute defaults (`backup` omitted → snapshots on for non-preview runs).
 */
export function resolvedEditEnhancedCallMetaParts(params: EditEnhancedParams): string[] {
	const previewOn = params.preview ?? false;
	const backupChip =
		previewOn ? undefined : (params.backup ?? true) ? "backup" : "no-backup";
	const bits = [previewOn ? "preview" : undefined, backupChip, params.nodeType ? params.nodeType : undefined].filter(Boolean);
	return bits as string[];
}

export function renderEditEnhancedCall(
	params: EditEnhancedParams,
	theme: Theme,
	_context: ToolRenderContext<any, EditEnhancedParams>,
): Component {
	const bits = resolvedEditEnhancedCallMetaParts(params);
	const meta = bits.length ? bits.join(", ") : undefined;
	return new Text(statusLine(theme, ICONS.pending, "Enhanced Edit", meta, params.path), 0, 0);
}

export function renderEditEnhancedResult(
	result: AgentToolResult<EditEnhancedDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, EditEnhancedParams>,
): Component {
	return renderResult(result, options, theme, editEnhancedResultConfig);
}
