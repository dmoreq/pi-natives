/**
 * `ls_enhanced` — repository topology mapping (`broot` `:print_tree` + native filesystem fallback).
 */
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";

import { BrootTopologyMapper } from "../broot-topology.ts";
import { lsEnhancedSchema } from "../schemas.ts";
import {
	formatLsEnhancedBlock,
	renderLsEnhancedCall,
	renderLsEnhancedResult,
	type LsEnhancedDetails,
	type LsEnhancedParams,
} from "../ls-render.ts";
import { executeSafe } from "./shared.ts";
import { withOutputTruncation } from "../shared/truncate.ts";
import { PromptBuilder } from "../routing/prompt-builder";

export interface RegisterLsEnhancedToolOptions {
	mapper?: BrootTopologyMapper;
}

export function registerLsEnhancedTool(pi: ExtensionAPI, description: string, options?: RegisterLsEnhancedToolOptions) {
	const mapper = options?.mapper ?? new BrootTopologyMapper();

	pi.registerTool({
		name: "ls_enhanced",
		label: "Enhanced Directory Listing",
		description,
		promptSnippet: "repository topology mapping — structured directory trees with metadata",
		promptGuidelines: PromptBuilder.guidelinesFor("ls_enhanced"),
		parameters: lsEnhancedSchema,
		async execute(
			_toolCallId: string,
			params: LsEnhancedParams,
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<LsEnhancedDetails>> {
			return executeSafe(
				"ls_enhanced",
				() => ({
					targetPathArg: ".",
					relRootFromWorkspace: "",
					topologyJson: "{}",
					result: "",
					topology: [],
					totalFiles: 0,
					totalDirectories: 0,
					scanTime: 0,
					method: "native",
					gitAware: false,
					resolvedRoot: ctx.cwd,
				}),
				async () => {
					const cwdBase = params.cwd ?
						path.isAbsolute(params.cwd) ?
							path.normalize(params.cwd)
						:	path.resolve(ctx.cwd, params.cwd)
					:	ctx.cwd;
					const pathArg = (params.path ?? ".").trim() || ".";

					const scan = await mapper.map({
						path: pathArg,
						depth: params.depth,
						includeHidden: params.includeHidden,
						includeGitStatus: params.includeGitStatus,
						filterTypes: params.filterTypes,
						minSizeBytes: params.minSizeBytes,
						maxSizeBytes: params.maxSizeBytes,
						preferBroot: params.preferBroot,
						cwd: cwdBase,
					});

					const relRootFromWorkspace = path.relative(ctx.cwd, scan.resolvedRoot) || scan.resolvedRoot;
					const topologyJson = JSON.stringify({ topology: scan.topology }, null, 2);

					const details: LsEnhancedDetails = {
						...scan,
						targetPathArg: pathArg,
						relRootFromWorkspace,
						topologyJson,
						result: "",
					};
					details.result = formatLsEnhancedBlock(details);

					return withOutputTruncation({ text: details.result, details });
				},
			);
		},
		renderCall: renderLsEnhancedCall,
		renderResult: renderLsEnhancedResult,
	});
}
