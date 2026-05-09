/**
 * `search` tool — regex file content search via ripgrep.
 *
 * Trigger condition: When you have a PRECISE regex pattern and want
 * to search file CONTENTS. This is the DEFAULT content search tool.
 *
 * Do NOT use for: fuzzy filename search (→ fzf), file listing (→ fd),
 * conceptual discovery (→ bm25), AST-aware patterns (→ semgrep).
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { searchSchema } from "../schemas";
import { grep, GrepError } from "../ripgrep";
import { renderGrepCall, renderGrepResult, type GrepToolParams, type GrepToolDetails } from "../render";
import { executeSafe, formatContentMatches } from "./shared";
import { withOutputTruncation } from "../shared/truncate";
import { PromptBuilder } from "../routing/prompt-builder";

export function registerSearchTool(pi: ExtensionAPI, searchDescription: string) {
	pi.registerTool({
		name: "search",
		label: "Grep",
		description: searchDescription,
		promptSnippet: "search file contents with regex (ripgrep engine) — your DEFAULT content search tool",
		promptGuidelines: PromptBuilder.guidelinesFor("search"),
		parameters: searchSchema,
		async execute(
			_toolCallId: string,
			params: GrepToolParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<GrepToolDetails>> {
			const searchPath = params.path || ctx.cwd;

			return executeSafe("Search", () => ({
				query: params.pattern,
				path: searchPath,
				matchCount: 0,
				fileCount: 0,
				filesSearched: 0,
				result: "",
			}), async () => {
				const result = await grep({
					pattern: params.pattern,
					path: searchPath,
					glob: params.glob,
					type: params.type,
					ignoreCase: params.i,
					gitignore: params.gitignore ?? true,
					offset: params.skip ?? 0,
					maxCount: params.maxCount ?? 20,
					contextBefore: params.contextBefore ?? 0,
					contextAfter: params.contextAfter ?? 0,
					mode: "content",
					cwd: ctx.cwd,
				});

				const resultText = formatContentMatches(result.matches, ctx.cwd);

				const details: GrepToolDetails = {
					query: params.pattern,
					path: searchPath,
					matchCount: result.totalMatches,
					fileCount: result.filesWithMatches,
					filesSearched: result.filesSearched,
					limitReached: result.limitReached,
					result: resultText,
				};

				return withOutputTruncation({ text: resultText, details });
			});
		},
		renderCall: renderGrepCall,
		renderResult: renderGrepResult,
	});
}
