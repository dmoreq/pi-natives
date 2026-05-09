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
		promptGuidelines: [
			"Use `edit_enhanced` when refactoring code STRUCTURALLY — rename idioms captured by metavariable-safe patterns (`$X`, `$$$ARGS`) rather than brittle multiline regex.",
			"The tool routes **code files** through ast-grep rewrite when `sg` / `ast-grep` exists; prose, JSON snippets, configs, etc. fall back to **literal substring** replace.",
			"Always **`preview: true` first** for risky edits: it prints the ast-grep diff (or pseudo-diff) without mutating disk.",
			"Prefer the builtin `edit`/`write` patch flow for trivial one-line typo fixes already expressed as exact snippets.",
			"Pass **`nodeType`** when you want stricter/smarter matcher behavior; you still MUST supply concrete `pattern` / `replacement` strings.",
			"Enable **`backup`** (default on) unless you explicitly want to skip snapshots; restores can use `AstFileEditor.restore` from the Bun writer helpers when needed.",
			"When ast-grep is missing entirely, edits still work for native literals — but not for metavariable patterns.",
			"If `syntax_ok` reads false, treat the rewritten file as suspect and repair before proceeding.",
			"**`scope`**: omit or use `file` for whole-file rewrites only. Passing `function` / `class` is allowed for forward compatibility — it does **not** limit matches today; you will receive a **warnings** line explaining that scoped narrowing is reserved for a future release.",
		],
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
