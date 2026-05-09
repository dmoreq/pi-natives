/**
 * `tokei` tool — fast code line counter (lines, code, comments, blanks).
 *
 * Trigger condition: When you need to COUNT or ANALYZE code volume:
 * "How many lines of code in this project?", "What languages are used?",
 * "Show me code/comment/blank line breakdown by language."
 *
 * tokei is like `cloc` but faster (Rust), respects .gitignore, and
 * auto-detects 200+ languages.
 *
 * Do NOT use for: searching code content (→ search), structural search (→ ast_grep),
 * file finding (→ fd/fzf), conceptual search (→ bm25).
 */
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { tokeiSchema } from "../schemas";
import { tokeiCount, formatTokeiResults, TokeiError } from "../tokei";
import {
	renderTokeiCall,
	renderTokeiResult,
	type TokeiCountParams,
	type TokeiCountDetails,
} from "../tokei-render";
import { executeSafe } from "./shared";
import { withOutputTruncation } from "../shared/truncate";
import { PromptBuilder } from "../routing/prompt-builder";

export function registerTokeiTool(pi: ExtensionAPI, tokeiDescription: string) {
	pi.registerTool({
		name: "count_lines",
		label: "Count Lines (tokei)",
		description: tokeiDescription,
		promptSnippet: "count lines of code, comments, and blanks by language (tokei) — for codebase STATISTICS, not search",
		promptGuidelines: PromptBuilder.guidelinesFor("count_lines"),
		parameters: tokeiSchema,
		async execute(
			_toolCallId: string,
			params: TokeiCountParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<TokeiCountDetails>> {
			const paths = params.paths && params.paths.length > 0 ? params.paths : ["."];

			return executeSafe("tokei", () => ({
				paths: paths.join(", "),
				languageCount: 0,
				totalFiles: 0,
				totalLines: 0,
				totalCode: 0,
				totalComments: 0,
				totalBlanks: 0,
				result: "",
			}), async () => {
				const result = await tokeiCount({
					paths,
					files: params.files,
					exclude: params.exclude,
					hidden: params.hidden,
					noIgnore: params.noIgnore,
					types: params.types,
					sort: params.sort,
					reverseSort: params.reverseSort,
					cwd: ctx.cwd,
				});

				const resultText = formatTokeiResults(result);

				const langCount = Object.keys(result.languages).filter(k => k !== "Total").length;
				const totalFiles = Object.values(result.languages)
					.filter(l => l.files)
					.reduce((sum, l) => sum + l.files.length, 0);

				const details: TokeiCountDetails = {
					paths: paths.join(", "),
					languageCount: langCount,
					totalFiles,
					totalLines: result.total.lines,
					totalCode: result.total.code,
					totalComments: result.total.comments,
					totalBlanks: result.total.blanks,
					result: resultText,
				};

				return withOutputTruncation({ text: resultText, details });
			});
		},
		renderCall: renderTokeiCall,
		renderResult: renderTokeiResult,
	});
}
