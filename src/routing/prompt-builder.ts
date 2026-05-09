/**
 * Builds consistent `promptGuidelines` arrays from centralized JSON configuration.
 */

import rawGuidelinesConfig from "./guidelines-config.json";
import type { PiSherlockToolName } from "./types";

export interface ToolGuidelineEntry {
	readonly primaryUse: string;
	readonly triggers: readonly string[];
	readonly avoid: readonly string[];
	readonly critical: readonly string[];
	readonly examples: readonly string[];
}

interface GuidelinesConfigFile {
	readonly tools: Readonly<Record<string, ToolGuidelineEntry>>;
}

export const GUIDELINES_CONFIG = rawGuidelinesConfig as GuidelinesConfigFile;

/** All tools that must appear under `guidelines-config.json → tools`. */
export const REQUIRED_GUIDELINE_TOOL_NAMES: readonly PiSherlockToolName[] = [
	"search",
	"concept_search",
	"ripgrep",
	"find_files",
	"fuzzy_find",
	"semgrep",
	"ast_grep",
	"count_lines",
	"find_duplicates",
	"read_enhanced",
	"write_enhanced",
	"edit_enhanced",
	"shell_enhanced",
	"ls_enhanced",
] as const;

export class PromptBuilder {
	/** Format a single tool's guideline record into registrar-ready strings. */
	static buildGuidelines(_toolName: string, config: ToolGuidelineEntry): string[] {
		const guidelines: string[] = [`Primary: ${config.primaryUse}`];

		for (const t of config.triggers) guidelines.push(`Use when: ${t}`);
		for (const a of config.avoid) guidelines.push(`Avoid: ${a}`);
		for (const c of config.critical) guidelines.push(`CRITICAL: ${c}`);
		for (const ex of config.examples) guidelines.push(`Example: ${ex}`);

		return guidelines;
	}

	/** Typed accessor for a known Pi Sherlock tool name. */
	static guidelinesFor(toolName: PiSherlockToolName): string[] {
		const cfg = GUIDELINES_CONFIG.tools[toolName];
		if (!cfg) throw new Error(`Missing guidelines config for tool "${toolName}"`);
		return PromptBuilder.buildGuidelines(toolName, cfg);
	}
}

/** Returns tool names missing from the JSON configuration (excluding unknown keys). */
export function missingGuidelineTools(): PiSherlockToolName[] {
	return REQUIRED_GUIDELINE_TOOL_NAMES.filter(name => GUIDELINES_CONFIG.tools[name] == null);
}
