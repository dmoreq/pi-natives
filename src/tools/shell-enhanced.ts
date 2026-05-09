/**
 * `shell_enhanced` — structured shell execution via Nushell JSON pipelines + POSIX fallbacks.
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { shellEnhancedSchema } from "../schemas";
import { NushellJsonExecutor } from "../nushell-json.ts";
import {
	formatShellEnhancedBlock,
	renderShellEnhancedCall,
	renderShellEnhancedResult,
	type ShellEnhancedDetails,
	type ShellEnhancedParams,
} from "../shell-render.ts";
import { executeSafe } from "./shared";

export interface RegisterShellEnhancedToolOptions {
	executor?: NushellJsonExecutor;
	executorFactory?: () => NushellJsonExecutor;
}

function resolveExecutor(options?: RegisterShellEnhancedToolOptions): NushellJsonExecutor {
	return options?.executor ?? options?.executorFactory?.() ?? new NushellJsonExecutor();
}

export function registerShellEnhancedTool(
	pi: ExtensionAPI,
	description: string,
	options?: RegisterShellEnhancedToolOptions,
) {
	const executor = resolveExecutor(options);

	pi.registerTool({
		name: "shell_enhanced",
		label: "Enhanced Shell",
		description,
		promptSnippet: "structured shell execution with JSON pipelines — eliminates parsing ambiguity",
		promptGuidelines: [
			"Use `shell_enhanced` whenever you **want tabular/machine-shaped results** (`ls`, `ps`, `$env`, `git log/status`) without hand-parsing columns from raw POSIX text.",
			"Prefer the builtin **bash**/shell helpers for **opaque one-off scripting**, interactive TUIs, or commands not covered by the JSON pipeline heuristics.",
			"Keep `enforceJson: true` (default) whenever Nushell is installed—pipelines terminate with deterministic JSON blobs consumable downstream.",
			"Set `enforceJson: false` to force verbatim POSIX semantics even when Nu is installed (heavy escape sequences stay untouched).",
			"Tune `fallbackToBun` / `fallbackToBun:false` when POSIX must skip the **Bun `$` shell** tier (import `{ $ } from 'bun'`, spec `Bun.$`) and go straight to `bash`/`sh`.",
			"If the builtin **`AbortSignal`** is aborted, timeouts + cancellation merge via **`AbortSignal.any`** into **Nu/bash spawns**. The **`Bun.$`** tier races **`signal.abort`** against the shell Promise (exit **125**) instead of injecting a Bun kill hook.",
		],
		parameters: shellEnhancedSchema,
		async execute(
			_toolCallId: string,
			params: ShellEnhancedParams,
			signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<ShellEnhancedDetails>> {
			return executeSafe(
				"shell_enhanced",
				() => ({
					output: {},
					rawOutput: "",
					exitCode: 1,
					executionTime: 0,
					shell: "bash",
					structured: false,
					commandPreview: params.command,
					performance: { startupTime: 0, executionTime: 0 },
					resolvedCwd: ctx.cwd,
				}),
				async () => {
					const resolvedCwd = params.cwd ?
						path.isAbsolute(params.cwd) ?
							path.normalize(params.cwd)
						:	path.resolve(ctx.cwd, params.cwd)
					:	ctx.cwd;

					const run = await executor.execute({
						command: params.command,
						enforceJson: params.enforceJson,
						timeout: params.timeout,
						cwd: resolvedCwd,
						env: params.env,
						fallbackToBun: params.fallbackToBun,
						signal,
					});

					const rel = path.relative(ctx.cwd, resolvedCwd) || resolvedCwd;
					const details: ShellEnhancedDetails = {
						...run,
						commandPreview: params.command,
						resolvedCwd,
					};

					const text = formatShellEnhancedBlock(details, rel);

					return { text, details };
				},
			);
		},
		renderCall: renderShellEnhancedCall,
		renderResult: renderShellEnhancedResult,
	});
}
