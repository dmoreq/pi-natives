/**
 * Rendering helpers for `ls_enhanced` repository topology results.
 */
import type { Theme, AgentToolResult, ToolRenderResultOptions, ToolRenderContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

import type { BrootResult } from "./broot-topology.ts";
import { ICONS, statusLine, renderResult, type ResultRenderConfig } from "./render-shared.ts";

export interface LsEnhancedParams {
	path?: string;
	cwd?: string;
	depth?: number;
	includeHidden?: boolean;
	includeGitStatus?: boolean;
	filterTypes?: string[];
	minSizeBytes?: number;
	maxSizeBytes?: number;
	preferBroot?: boolean;
}

export interface LsEnhancedDetails extends BrootResult {
	/** Path argument after resolution against cwd (for display). */
	targetPathArg: string;
	/** Resolved listing root vs agent workspace cwd. */
	relRootFromWorkspace: string;
	/** Canonical JSON topology for programmatic consumers. */
	topologyJson: string;
	/** Full block shown to the agent renderer (matches `AgentToolResult` text payload). */
	result: string;
}

export function formatLsEnhancedBlock(details: LsEnhancedDetails): string {
	const head = [
		`target: ${details.relRootFromWorkspace}`,
		`resolvedRoot: ${details.resolvedRoot}`,
		`method: ${details.method}`,
		`scanMs: ${details.scanTime}`,
		`totals: files=${details.totalFiles} dirs=${details.totalDirectories}`,
		`gitAware: ${details.gitAware}`,
		"",
		"---topology_json---",
		details.topologyJson,
	].join("\n");
	return head;
}

const lsEnhancedResultConfig: ResultRenderConfig<LsEnhancedDetails> = {
	label: "Enhanced Directory Listing",
	getQuery: d => d.relRootFromWorkspace.slice(0, 140),
	getMeta: d =>
		[
			d.method,
			d.gitAware ? "git" : "",
			detailsShort(d.scanTime),
			`f${d.totalFiles}/d${d.totalDirectories}`,
		].filter(Boolean),
	getIcon: () => ICONS.success,
};

function detailsShort(scanMs: number): string {
	return `${scanMs}ms`;
}

export function renderLsEnhancedCall(
	params: LsEnhancedParams,
	theme: Theme,
	_context: ToolRenderContext<any, LsEnhancedParams>,
): Component {
	const bits = [
		params.depth !== undefined ? `depth ${params.depth}` : undefined,
		params.includeHidden ? "hidden" : undefined,
		params.includeGitStatus === false ? "no-git" : undefined,
		params.preferBroot === false ? "native" : undefined,
	].filter(Boolean);
	const hint = bits.length ? bits.join(", ") : undefined;
	return new Text(
		statusLine(
			theme,
			ICONS.pending,
			"Enhanced Directory Listing",
			hint,
			(params.path ?? ".").slice(0, 120),
		),
		0,
		0,
	);
}

export function renderLsEnhancedResult(
	result: AgentToolResult<LsEnhancedDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
	_context: ToolRenderContext<any, LsEnhancedParams>,
): Component {
	return renderResult(result, options, theme, lsEnhancedResultConfig);
}
