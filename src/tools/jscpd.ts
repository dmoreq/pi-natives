/**
 * `jscpd` tool — copy/paste detection for finding duplicated code.
 *
 * Trigger condition: When you need to find DUPLICATED or REDUNDANT code
 * blocks. "Is there copy-pasted code in this codebase?" "Find repeated
 * code blocks." "Are these two files actually the same?"
 *
 * jscpd finds both exact and near-duplicate code blocks. Unlike text-based
 * tools (search) or AST-based tools (ast_grep), jscpd understands code
 * tokens and can detect clones even with renamed variables.
 *
 * Do NOT use for: text search (→ search), structural patterns (→ ast_grep),
 * security analysis (→ semgrep), code stats (→ tokei).
 */
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { jscpdSchema } from "../schemas";
import { jscpdDetect, formatJscpdResults, JscpdError } from "../jscpd";
import {
	renderJscpdCall,
	renderJscpdResult,
	type JscpdDetectParams,
	type JscpdDetectDetails,
} from "../jscpd-render";
import { executeSafe } from "./shared";

export function registerJscpdTool(pi: ExtensionAPI, jscpdDescription: string) {
	pi.registerTool({
		name: "find_duplicates",
		label: "Find Duplicates (jscpd)",
		description: jscpdDescription,
		promptSnippet: "detect duplicated/copy-pasted code blocks (jscpd) — find redundant code that should be refactored",
		promptGuidelines: [
			"Use `find_duplicates` when you need to find DUPLICATED or COPY-PASTED code blocks in a codebase.",
			"find_duplicates detects exact clones (mode: 'strict') and near-duplicates (mode: 'mild' or 'weak').",
			"Default `minLines: 5` — duplicates shorter than this are ignored. Lower for smaller snippets.",
			"Use `ignore` to skip test files, generated code, or vendor directories.",
			"Use `format` to filter by language (e.g., ['typescript', 'python']).",
			"After finding duplicates, use `ast_grep` to plan refactoring, or `search` to find all occurrences.",
		],
		parameters: jscpdSchema,
		async execute(
			_toolCallId: string,
			params: JscpdDetectParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<JscpdDetectDetails>> {
			const scanPaths = params.paths && params.paths.length > 0 ? params.paths : ["."];
			const mode = params.mode ?? "strict";

			return executeSafe("jscpd", () => ({
				query: scanPaths.join(", "),
				mode,
				totalClones: 0,
				totalDuplicatedLines: 0,
				percentage: 0,
				totalSources: 0,
				result: "",
			}), async () => {
				const result = await jscpdDetect({
					paths: scanPaths,
					minLines: params.minLines ?? 5,
					minTokens: params.minTokens ?? 50,
					mode,
					ignore: params.ignore,
					format: params.format,
					cwd: ctx.cwd,
				});

				const resultText = formatJscpdResults(result, ctx.cwd);

				const details: JscpdDetectDetails = {
					query: scanPaths.join(", "),
					mode,
					totalClones: result.totalClones,
					totalDuplicatedLines: result.totalDuplicatedLines,
					percentage: result.percentage,
					totalSources: result.totalSources,
					result: resultText,
				};

				return { text: resultText, details };
			});
		},
		renderCall: renderJscpdCall,
		renderResult: renderJscpdResult,
	});
}
