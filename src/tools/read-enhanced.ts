/**
 * `read_enhanced` — structure-aware reading for large/source/config files.
 *
 * Routes by file type: ast-grep skeletons for code, jq/yq for data, bat for prose.
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { readEnhancedSchema } from "../schemas";
import { SmartFileReader } from "../smart-reader.ts";
import {
	formatEnhancedReadBlock,
	renderReadEnhancedCall,
	renderReadEnhancedResult,
	type ReadEnhancedParams,
	type ReadEnhancedDetails,
} from "../read-render.ts";
import { executeSafe } from "./shared";
import { withOutputTruncation } from "../shared/truncate.ts";
import { PromptBuilder } from "../routing/prompt-builder";

export interface RegisterReadEnhancedToolOptions {
	/** Inject a reader (e.g. custom command runner); defaults to {@link SmartFileReader}. */
	reader?: SmartFileReader;
}

export function registerReadEnhancedTool(
	pi: ExtensionAPI,
	description: string,
	options?: RegisterReadEnhancedToolOptions,
) {
	const reader = options?.reader ?? new SmartFileReader();

	pi.registerTool({
		name: "read_enhanced",
		label: "Enhanced Read",
		description,
		promptSnippet:
			"structure-aware file reading — for large files, JSON/YAML, with smart formatting",
		promptGuidelines: PromptBuilder.guidelinesFor("read_enhanced"),
		parameters: readEnhancedSchema,
		async execute(
			_toolCallId: string,
			params: ReadEnhancedParams,
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<ReadEnhancedDetails>> {
			return executeSafe(
				"read_enhanced",
				() => ({
					path: params.path,
					method: "error",
					fileType: "text",
					estimatedTokens: 0,
					readTimeMs: 0,
					fileSizeBytes: 0,
					fallbacks: [],
					result: "",
				}),
				async () => {
					const resolved = path.isAbsolute(params.path)
						? path.normalize(params.path)
						: path.resolve(ctx.cwd, params.path);
					const out = await reader.read({
						filePath: resolved,
						cwd: ctx.cwd,
						jqQuery: params.jqQuery,
						yqQuery: params.yqQuery,
					});

					const rel = path.relative(ctx.cwd, resolved) || resolved;
					const text = formatEnhancedReadBlock(out, rel);
					const details: ReadEnhancedDetails = {
						path: params.path,
						method: out.method,
						fileType: out.fileType,
						codeLanguage: out.codeLanguage,
						dataFormat: out.dataFormat,
						estimatedTokens: out.estimatedTokens,
						readTimeMs: out.readTimeMs,
						fileSizeBytes: out.fileSizeBytes,
						fallbacks: out.fallbacks,
						result: text,
					};

					return withOutputTruncation({ text, details }, params.maxChars, params.maxLines);
				},
			);
		},
		renderCall: renderReadEnhancedCall,
		renderResult: renderReadEnhancedResult,
	});
}
