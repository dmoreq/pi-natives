/**
 * `fzf` tool — fuzzy file PATH search (not content search).
 *
 * Trigger condition: When you know APPROXIMATE file names but not exact
 * paths. Query terms are fuzzy-matched — "auth mid" matches
 * "src/auth/middleware.ts". Results are file PATHS, not file contents.
 *
 * Do NOT use for: searching file CONTENTS (→ search), conceptual search (→ bm25),
 * exact filename matching (→ fd), AST patterns (→ semgrep).
 */
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { fzfSchema } from "../schemas";
import { fzfSearch, FzfError } from "../fzf";
import { renderFzfCall, renderFzfResult, type FzfSearchParams, type FzfSearchDetails } from "../fzf-render";
import { executeSafe } from "./shared";
import { withOutputTruncation } from "../shared/truncate";

export function registerFzfTool(pi: ExtensionAPI, fzfDescription: string) {
	pi.registerTool({
		name: "fuzzy_find",
		label: "Fuzzy Find (fzf)",
		description: fzfDescription,
		promptSnippet: "fuzzy file PATH search (fzf engine) — for approximate filenames, NOT content",
		promptGuidelines: [
			"Use `fuzzy_find` when you know APPROXIMATE file names but not exact paths.",
			"Prefer `fuzzy_find` over `search` (regex) for filename discovery.",
			"Use `search` for file CONTENT searches and `concept_search` for conceptual search.",
			"Query terms in `fuzzy_find` can be in any order and don't need to be contiguous.",
			"Combine `fuzzy_find` → `search`: find the file with fuzzy_find, then grep its contents with search.",
		],
		parameters: fzfSchema,
		async execute(
			_toolCallId: string,
			params: FzfSearchParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<FzfSearchDetails>> {
			const searchPath = params.path || ctx.cwd;

			return executeSafe("Fzf search", () => ({
				query: params.query,
				matchCount: 0,
				totalFiles: 0,
				limitReached: false,
				result: "",
			}), async () => {
				const result = await fzfSearch({
					query: params.query,
					path: searchPath,
					glob: params.glob,
					limit: params.limit ?? 20,
					cwd: ctx.cwd,
				});

				const formattedLines = result.matches.map(m => m.path);
				const resultText = formattedLines.length > 0
					? formattedLines.join("\n")
					: "(no matching files found)";

				const details: FzfSearchDetails = {
					query: params.query,
					matchCount: result.totalMatches,
					totalFiles: result.totalFiles,
					limitReached: result.limitReached,
					result: resultText,
				};

				return withOutputTruncation({ text: resultText, details });
			});
		},
		renderCall: renderFzfCall,
		renderResult: renderFzfResult,
	});
}
