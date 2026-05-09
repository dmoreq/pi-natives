/**
 * Rendering helpers for `shell_enhanced` structured shell results.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

import type { NushellJsonResult } from "./nushell-json.ts";
import { ICONS, statusLine, renderResult, type ResultRenderConfig } from "./render-shared.ts";

export interface ShellEnhancedParams {
	command: string;
	enforceJson?: boolean;
	timeout?: number;
	cwd?: string;
	env?: Record<string, string>;
	fallbackToBun?: boolean;
}

export interface ShellEnhancedDetails extends NushellJsonResult {
	resolvedCwd?: string;
	commandPreview: string;
}

function snippetFromOutput(output: any, maxChars: number): string {
	try {
		const s =
			output === undefined || output === null ? ""
			: typeof output === "string" ?
				output
			:	JSON.stringify(output, null, 0);
		if (s.length <= maxChars) return s;
		return `${s.slice(0, maxChars)} …`;
	} catch {
		return "[unserializable output]";
	}
}

function stderrFromOutput(output: any): string | undefined {
	if (
		output &&
		typeof output === "object" &&
		!Array.isArray(output) &&
		typeof (output as { stderr?: unknown }).stderr === "string"
	) {
		return (output as { stderr: string }).stderr;
	}
	return undefined;
}

export function formatShellEnhancedBlock(
	details: ShellEnhancedDetails,
	relWorkdirHint: string,
): string {
	const structuredSnippet = snippetFromOutput(details.output, 6000);
	const lines = [
		`cwd: ${relWorkdirHint}`,
		`shell: ${details.shell}`,
		`exit: ${details.exitCode}`,
		`structured: ${details.structured}`,
		`startupMs: ${details.performance.startupTime.toFixed(1)}`,
		`execMs: ${details.performance.executionTime.toFixed(1)}`,
	];

	const errLine = stderrFromOutput(details.output);
	if (details.exitCode !== 0 && errLine?.trim()) {
		lines.push(`stderr: ${errLine.trim()}`);
	}

	lines.push("---structured---");
	lines.push(structuredSnippet);
	lines.push("---rawStdout---");
	lines.push(details.rawOutput.length ? details.rawOutput : "(empty)");
	return lines.join("\n");
}

const shellEnhancedResultConfig: ResultRenderConfig<ShellEnhancedDetails> = {
	label: "Enhanced Shell",
	getQuery: d => d.commandPreview.slice(0, 140),
	getMeta: d =>
		[
			d.shell,
			`exit:${d.exitCode}`,
			d.structured ? "json" : "text",
			`${d.performance.executionTime.toFixed(1)} ms`,
		].filter(Boolean),
	getIcon: d => (d.exitCode === 0 ? ICONS.success : ICONS.warning),
};

export function renderShellEnhancedCall(
	params: ShellEnhancedParams,
	theme: Theme,
	_context: ToolRenderContext<any, ShellEnhancedParams>,
): Component {
	const bits = [
		params.enforceJson === false ? "no-json-rule" : undefined,
		params.fallbackToBun === false ? "bash-tier" : undefined,
		params.timeout ? `timeout ${params.timeout}ms` : undefined,
	].filter(Boolean);
	const meta = bits.length ? bits.join(", ") : undefined;
	return new Text(
		statusLine(theme, ICONS.pending, "Enhanced Shell", meta, params.command.slice(0, 140)),
		0,
		0,
	);
}

export function renderShellEnhancedResult(
	result: AgentToolResult<ShellEnhancedDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, ShellEnhancedParams>,
): Component {
	return renderResult(result, options, theme, shellEnhancedResultConfig);
}
