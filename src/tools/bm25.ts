/**
 * `concept_search` — relevance-ranked content search via BM25.
 *
 * Trigger condition: When you have a CONCEPTUAL or OPEN-ENDED query and
 * don't know the exact regex. Use for natural-language discovery.
 *
 * Do NOT use for: exact regex matching (→ search), filename search (→ fzf),
 * file listing (→ fd), AST patterns (→ semgrep).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { bm25Schema } from "../schemas";
import { Bm25Index } from "../bm25";
import { renderBm25Call, renderBm25Result, type Bm25ToolParams, type Bm25ToolDetails } from "../render";
import { executeSafe } from "./shared";
import { withOutputTruncation } from "../shared/truncate";
import { extractSnippet } from "../shared/utils";
import { collectFilesWithContent } from "../shared/fs";
import { GrepError } from "../shared/errors";
import { PromptBuilder } from "../routing/prompt-builder";

export function registerBm25Tool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "concept_search",
		label: "Concept Search (BM25)",
		description: "Relevance-ranked file content search using BM25. Use for open-ended or conceptual queries.",
		promptSnippet: "search file content by relevance (BM25 ranking) — for conceptual discovery, not exact patterns",
		promptGuidelines: PromptBuilder.guidelinesFor("concept_search"),
		parameters: bm25Schema,
		async execute(
			_toolCallId: string,
			params: Bm25ToolParams,
			signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<Bm25ToolDetails>> {
			const limit = params.limit ?? 10;
			const searchPaths = params.paths && params.paths.length > 0 ? params.paths : [ctx.cwd];

			return executeSafe("BM25 search", () => ({
				query: params.query,
				matches: [],
				totalDocuments: 0,
				documentsSearched: 0,
			}), async () => {
				// Collect files across all search paths
				let allFiles: Array<{ id: string; text: string }> = [];
				for (const sp of searchPaths) {
					const resolvedPath = path.resolve(ctx.cwd, sp);
					const stat = await fs.stat(resolvedPath).catch(() => null);
					if (!stat) continue;

					if (stat.isDirectory()) {
						const files = await collectFilesWithContent(resolvedPath, ctx.cwd);
						allFiles = allFiles.concat(files);
					} else if (stat.isFile()) {
						try {
							const content = await fs.readFile(resolvedPath, "utf-8");
							if (content) {
								allFiles.push({ id: path.relative(ctx.cwd, resolvedPath), text: content });
							}
						} catch {
							// skip unreadable
						}
					}
				}

				// Build BM25 index and search
				const index = new Bm25Index();
				index.addDocuments(allFiles);
				const results = index.search(params.query, limit);

				// Build result details
				const matches = results.map(r => {
					const doc = allFiles.find(f => f.id === r.id);
					const snippet = doc ? extractSnippet(doc.text, params.query, 120) : undefined;
					return { id: r.id, score: r.score, snippet };
				});

				const formattedLines = matches.map(
					m => `${m.id} (score: ${m.score.toFixed(3)})${m.snippet ? `\n  ...${m.snippet}...` : ""}`,
				);

				const formattedText = formattedLines.length > 0
					? formattedLines.join("\n")
					: "(no relevant matches found)";

				const details: Bm25ToolDetails = {
					query: params.query,
					matches,
					totalDocuments: index.documentCount,
					documentsSearched: allFiles.length,
				};

				return withOutputTruncation({ text: formattedText, details });
			});
		},
		renderCall: renderBm25Call,
		renderResult: renderBm25Result,
	});
}
