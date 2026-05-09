/**
 * `write_enhanced` — Bun-native high-throughput writes (atomic rename, backups, streaming).
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { writeEnhancedSchema } from "../schemas";
import { BunFileWriter } from "../bun-writer.ts";
import {
	formatWriteEnhancedBlock,
	renderWriteEnhancedCall,
	renderWriteEnhancedResult,
	type WriteEnhancedParams,
	type WriteEnhancedDetails,
} from "../write-render.ts";
import { executeSafe } from "./shared";

export interface RegisterWriteEnhancedToolOptions {
	/** Inject writer (defaults to fresh {@link BunFileWriter}). */
	writer?: BunFileWriter;
}

export function registerWriteEnhancedTool(
	pi: ExtensionAPI,
	description: string,
	options?: RegisterWriteEnhancedToolOptions,
) {
	const writer = options?.writer ?? new BunFileWriter();

	pi.registerTool({
		name: "write_enhanced",
		label: "Enhanced Write",
		description,
		promptSnippet:
			"high-performance file writing — atomic operations, streaming, backups for large content",
		promptGuidelines: [
			"Use `write_enhanced` when you need ATOMIC whole-file updates, optional `.bak` snapshots, or large payloads with optional streaming to a temp file before rename.",
			"Prefer the builtin `write` tool for small, simple scratch edits where atomicity and backup are unnecessary.",
			"Set `atomic: false` for a direct replace `Bun.write`, or append via read-merge + `Bun.write` (`mode: 'append'`, `atomic: false`) instead of posix `appendFile`.",
			"For append that must stay consistent with concurrent readers, use `mode: 'append'` with `atomic: true` (read-merge-write + atomic rename; cost scales with file size).",
			"Enable `backup: true` before risky refactors to preserved paths; use the `backup` path in output if you need to revert manually.",
		],
		parameters: writeEnhancedSchema,
		async execute(
			_toolCallId: string,
			params: WriteEnhancedParams,
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<WriteEnhancedDetails>> {
			return executeSafe(
				"write_enhanced",
				() => ({
					path: params.path,
					resolvedPath: "",
					bytesWritten: 0,
					writeTime: 0,
					atomic: false,
					method: "bun-direct",
				}),
				async () => {
					const resolved = path.isAbsolute(params.path)
						? path.normalize(params.path)
						: path.resolve(ctx.cwd, params.path);
					const out = await writer.write({
						path: resolved,
						content: params.content,
						mode: params.mode,
						atomic: params.atomic,
						backup: params.backup,
						streaming: params.streaming,
					});
					const rel = path.relative(ctx.cwd, resolved) || resolved;
					const details: WriteEnhancedDetails = {
						...out,
						path: params.path,
						resolvedPath: resolved,
					};
					const text = formatWriteEnhancedBlock(details, rel);
					return { text, details };
				},
			);
		},
		renderCall: renderWriteEnhancedCall,
		renderResult: renderWriteEnhancedResult,
	});
}
