/**
 * `fd` tool — fast file and directory finding (name, extension, type).
 *
 * Trigger condition: When you need to FIND FILES by name, extension, or type.
 * Equivalent to `find` but faster and .gitignore-aware. Use for "list all
 * .ts files" or "find files named config".
 *
 * Do NOT use for: searching file CONTENTS (→ search), fuzzy filename (→ fzf),
 * conceptual search (→ bm25), AST patterns (→ semgrep).
 */
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { fdSchema } from "../schemas";
import { fdFind, FdError } from "../fd";
import { renderFdCall, renderFdResult, type FdFindParams, type FdFindDetails } from "../fd-render";
import { executeSafe } from "./shared";
import { withOutputTruncation } from "../shared/truncate";
import { PromptBuilder } from "../routing/prompt-builder";

export function registerFdTool(pi: ExtensionAPI, fdDescription: string) {
	pi.registerTool({
		name: "find_files",
		label: "Find Files (fd)",
		description: fdDescription,
		promptSnippet: "fast file and directory finding (fd engine) — for listing files by name/extension/type",
		promptGuidelines: PromptBuilder.guidelinesFor("find_files"),
		parameters: fdSchema,
		async execute(
			_toolCallId: string,
			params: FdFindParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<FdFindDetails>> {
			const searchPath = params.path || ctx.cwd;

			return executeSafe("Fd search", () => ({
				query: params.pattern || params.extension || params.glob || "all files",
				matchCount: 0,
				limitReached: false,
				result: "",
			}), async () => {
				const result = await fdFind({
					pattern: params.pattern,
					path: searchPath,
					glob: params.glob,
					extension: params.extension,
					type: params.type as any,
					hidden: params.hidden,
					noIgnore: params.noIgnore,
					maxResults: params.maxResults ?? 50,
					caseSensitive: params.caseSensitive,
					cwd: ctx.cwd,
				});

				const formattedLines = result.matches.map(m => m.path);
				const resultText = formattedLines.length > 0
					? formattedLines.join("\n")
					: "(no files found)";

				const details: FdFindDetails = {
					query: params.pattern || params.extension || params.glob || "all files",
					matchCount: result.totalMatches,
					limitReached: result.limitReached,
					result: resultText,
				};

				return withOutputTruncation({ text: resultText, details });
			});
		},
		renderCall: renderFdCall,
		renderResult: renderFdResult,
	});
}
