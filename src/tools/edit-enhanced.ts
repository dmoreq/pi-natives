/**
 * `edit_enhanced` — AST-aware rewrites via ast-grep with native literal fallback.
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { editEnhancedSchema } from "../schemas";
import { AstFileEditor } from "../ast-editor.ts";
import {
	formatEditEnhancedBlock,
	renderEditEnhancedCall,
	renderEditEnhancedResult,
	type EditEnhancedParams,
	type EditEnhancedDetails,
} from "../edit-render.ts";
import { executeSafe } from "./shared";
import { PromptBuilder } from "../routing/prompt-builder";

export interface RegisterEditEnhancedToolOptions {
	/** Inject editor instance (defaults to {@link AstFileEditor}). */
	editor?: AstFileEditor;
}

export function registerEditEnhancedTool(
	pi: ExtensionAPI,
	description: string,
	options?: RegisterEditEnhancedToolOptions,
) {
	const editor = options?.editor ?? new AstFileEditor();

	pi.registerTool({
		name: "edit_enhanced",
		label: "Enhanced Edit",
		description,
		promptSnippet:
			"AST-aware file editing — syntax-safe code modifications with preview and backup",
		promptGuidelines: PromptBuilder.guidelinesFor("edit_enhanced"),
		parameters: editEnhancedSchema,
		async execute(
			_toolCallId: string,
			params: EditEnhancedParams,
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<EditEnhancedDetails>> {
			return executeSafe(
				"edit_enhanced",
				() => ({
					path: params.path,
					resolvedPath: "",
					totalChanges: 0,
					editTime: 0,
					method: "native-string",
					syntaxValid: false,
					changes: [],
					warnings: [],
				}),
				async () => {
					const resolved = path.isAbsolute(params.path)
						? path.normalize(params.path)
						: path.resolve(ctx.cwd, params.path);

					const out = await editor.edit({
						path: resolved,
						pattern: params.pattern,
						replacement: params.replacement,
						preview: params.preview ?? false,
						backup: params.backup ?? true,
						nodeType: params.nodeType,
						scope: params.scope,
						cwd: params.cwd ?? ctx.cwd,
					});

					const rel = path.relative(ctx.cwd, resolved) || resolved;
					const details: EditEnhancedDetails = {
						...out,
						path: params.path,
						resolvedPath: resolved,
					};
					const text = formatEditEnhancedBlock(details, rel);
					return { text, details };
				},
			);
		},
		renderCall: renderEditEnhancedCall,
		renderResult: renderEditEnhancedResult,
	});
}
