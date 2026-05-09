/**
 * `ripgrep` tool — advanced ripgrep features (multiline, count, hidden, no-ignore).
 *
 * Trigger condition: Only when you need ADVANCED ripgrep features that
 * `search` does NOT expose:
 *   - Multiline patterns (multiline: true)
 *   - Match count per file (mode: "count")
 *   - File listing only (mode: "filesWithMatches")
 *   - Hidden/dotfiles (hidden: true)
 *   - Bypass .gitignore (noIgnore: true)
 *   - Fixed strings (fixedStrings: true)
 *   - Timeout (timeoutMs)
 *
 * Do NOT use for: standard content searches (→ search is simpler), AST patterns (→ semgrep),
 * file finding (→ fd, fzf), conceptual search (→ bm25).
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { ripgrepSchema } from "../schemas";
import { grep, GrepError } from "../ripgrep";
import { renderRipgrepCall, renderRipgrepResult, type RipgrepSearchParams, type RipgrepSearchDetails } from "../ripgrep-render";
import { executeSafe, formatContentMatches } from "./shared";
import { withOutputTruncation } from "../shared/truncate";
import { PromptBuilder } from "../routing/prompt-builder";

export function registerRipgrepTool(pi: ExtensionAPI, ripgrepDescription: string) {
	pi.registerTool({
		name: "ripgrep",
		label: "Ripgrep",
		description: ripgrepDescription,
		promptSnippet: "advanced file content search with ripgrep — only for features search doesn't have (multiline, count, hidden, no-ignore)",
		promptGuidelines: PromptBuilder.guidelinesFor("ripgrep"),
		parameters: ripgrepSchema,
		async execute(
			_toolCallId: string,
			params: RipgrepSearchParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<RipgrepSearchDetails>> {
			const searchPath = params.path || ctx.cwd;

			return executeSafe("Ripgrep search", () => ({
				pattern: params.pattern,
				path: searchPath,
				mode: (params.mode as any) ?? "content",
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
					ignoreCase: params.ignoreCase,
					multiline: params.multiline,
					hidden: params.hidden,
					gitignore: !params.noIgnore,
					offset: params.skip ?? 0,
					maxCount: params.maxCount ?? 50,
					contextBefore: params.contextBefore ?? 0,
					contextAfter: params.contextAfter ?? 0,
					maxColumns: params.maxColumns,
					mode: (params.mode as any) ?? "content",
					timeoutMs: params.timeoutMs,
					cwd: ctx.cwd,
				});

				// Format output by mode
				let resultText: string;
				if (params.mode === "count") {
					const formattedLines: string[] = [];
					for (const match of result.matches) {
						const relPath = path.relative(ctx.cwd, match.path);
						formattedLines.push(`${relPath}: ${match.matchCount} match${match.matchCount !== 1 ? "es" : ""}`);
					}
					resultText = formattedLines.length > 0 ? formattedLines.join("\n") : "(no matches)";
				} else if (params.mode === "filesWithMatches") {
					const formattedLines = result.matches.map(m => path.relative(ctx.cwd, m.path));
					resultText = formattedLines.length > 0 ? formattedLines.join("\n") : "(no files with matches)";
				} else {
					resultText = formatContentMatches(result.matches, ctx.cwd);
				}

				const uniqueFiles = new Set(result.matches.map(m => m.path));

				const details: RipgrepSearchDetails = {
					pattern: params.pattern,
					path: searchPath,
					mode: (params.mode as any) ?? "content",
					matchCount: result.totalMatches,
					fileCount: uniqueFiles.size,
					filesSearched: result.filesSearched,
					result: resultText,
				};

				return withOutputTruncation({ text: resultText, details });
			});
		},
		renderCall: renderRipgrepCall,
		renderResult: renderRipgrepResult,
	});
}
