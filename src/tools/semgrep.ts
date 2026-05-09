/**
 * `semgrep` tool — AST-aware static analysis and pattern-based code search.
 *
 * Trigger condition: When you need to match CODE STRUCTURE (function calls,
 * class definitions, control flow) that regex CANNOT reliably match.
 * Use for security audits, bug detection, code smells.
 *
 * Do NOT use for: simple text matching (→ search), filename search (→ fzf),
 * conceptual discovery (→ bm25).
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { semgrepSchema } from "../schemas";
import { semgrepScan, formatSemgrepResults, SemgrepError } from "../semgrep";
import { renderSemgrepCall, renderSemgrepResult, type SemgrepScanParams, type SemgrepScanDetails } from "../semgrep-render";
import { executeSafe } from "./shared";
import { withOutputTruncation } from "../shared/truncate";
import { PromptBuilder } from "../routing/prompt-builder";

export function registerSemgrepTool(pi: ExtensionAPI, semgrepDescription: string) {
	pi.registerTool({
		name: "semgrep",
		label: "Semgrep",
		description: semgrepDescription,
		promptSnippet: "static analysis and pattern-based code search (semgrep engine) — for CODE STRUCTURE, not text",
		promptGuidelines: PromptBuilder.guidelinesFor("semgrep"),
		parameters: semgrepSchema,
		async execute(
			_toolCallId: string,
			params: SemgrepScanParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<SemgrepScanDetails>> {
			const scanPath = params.path || ctx.cwd;

			return executeSafe("Semgrep scan", () => ({
				query: params.pattern || params.config || "auto",
				mode: (params.pattern ? "pattern" : params.config ? "config" : "auto") as "pattern" | "config" | "auto",
				matchCount: 0,
				fileCount: 0,
				filesScanned: 0,
				result: "",
			}), async () => {
				const result = await semgrepScan({
					pattern: params.pattern,
					config: params.config,
					path: scanPath,
					language: params.language,
					severity: params.severity as any,
					cwd: ctx.cwd,
				});

				const mode = params.pattern ? "pattern" as const : params.config ? "config" as const : "auto" as const;
				const query = params.pattern || params.config || "auto";
				const resultText = formatSemgrepResults(result, ctx.cwd);

				const uniqueFiles = new Set(result.matches.map(m => m.path));

				const details: SemgrepScanDetails = {
					query,
					mode,
					matchCount: result.totalMatches,
					fileCount: uniqueFiles.size,
					filesScanned: result.filesScanned,
					severity: params.severity as any,
					result: resultText,
				};

				return withOutputTruncation({ text: resultText, details });
			});
		},
		renderCall: renderSemgrepCall,
		renderResult: renderSemgrepResult,
	});
}
