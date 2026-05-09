/**
 * `ast-grep` tool — structural code search & refactoring via AST patterns.
 *
 * Trigger condition: When you need to find or transform CODE STRUCTURES
 * with metavariable capture ($X, $$$ARGS). Unlike semgrep (security/linting rules),
 * ast-grep is designed for STRUCTURAL SEARCH and AUTOMATED REFACTORING.
 *
 * Key differentiator from semgrep:
 *   semgrep  → linter/security: "does this code have bugs/vulns?"
 *   ast-grep → search/refactor: "find this pattern so I can understand or rewrite it"
 *
 * Do NOT use for: text matching (→ search), conceptual search (→ bm25),
 * security analysis (→ semgrep), filename search (→ fzf/fd).
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { astGrepSchema } from "../schemas";
import { astGrepSearch, formatAstGrepResults, AstGrepError } from "../ast-grep";
import {
	renderAstGrepCall,
	renderAstGrepResult,
	type AstGrepSearchParams,
	type AstGrepSearchDetails,
} from "../ast-grep-render";
import { executeSafe } from "./shared";
import { withOutputTruncation } from "../shared/truncate";
import { PromptBuilder } from "../routing/prompt-builder";

export function registerAstGrepTool(pi: ExtensionAPI, astGrepDescription: string) {
	pi.registerTool({
		name: "ast_grep",
		label: "ast-grep",
		description: astGrepDescription,
		promptSnippet: "structural code search & refactoring via AST patterns — for precise STRUCTURAL matching with metavariables",
		promptGuidelines: PromptBuilder.guidelinesFor("ast_grep"),
		parameters: astGrepSchema,
		async execute(
			_toolCallId: string,
			params: AstGrepSearchParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<AstGrepSearchDetails>> {
			const searchPath = params.path || ctx.cwd;

			return executeSafe("ast-grep", () => ({
				query: params.pattern,
				language: params.language,
				matchCount: 0,
				filesScanned: 0,
				warningCount: 0,
				result: "",
			}), async () => {
				const result = await astGrepSearch({
					pattern: params.pattern,
					language: params.language,
					path: searchPath,
					rewrite: params.rewrite,
					strictness: params.strictness,
					follow: params.follow,
					cwd: ctx.cwd,
				});

				const resultText = formatAstGrepResults(result, ctx.cwd);

				const details: AstGrepSearchDetails = {
					query: params.pattern,
					language: params.language,
					matchCount: result.totalMatches,
					filesScanned: result.filesScanned,
					warningCount: result.warnings.length,
					result: resultText,
				};

				return withOutputTruncation({ text: resultText, details });
			});
		},
		renderCall: renderAstGrepCall,
		renderResult: renderAstGrepResult,
	});
}
