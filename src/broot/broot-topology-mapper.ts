/**
 * Main orchestrator for broot topology mapping
 * 
 * Coordinates between broot binary execution, native fallback, and result processing.
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import { checkBinary } from "../shared/cli";
import { TopologyError } from "../shared/errors";
import type { BrootOptions, BrootResult, DirectoryNode } from "./types";
import { topologyFromPrintTreeStdout } from "./broot-parser";
import { gitRepoRoot, porcelainStatusMap, applyGitStatus } from "./git-integration";
import { 
	normalizedTypeFilters, 
	pruneHidden, 
	collapseDotGitSubtree, 
	filterTree, 
	applyDepthLimit, 
	summarizeTotals 
} from "./tree-filters";
import { NativeWalker } from "./native-walker";

const BROOT_TIMEOUT_MS = 60_000;

/**
 * Resolve which broot binary to use
 */
export function resolveBrootBinary(): "br" | "broot" | null {
	if (checkBinary("br")) return "br";
	if (checkBinary("broot")) return "broot";
	return null;
}

/**
 * Main topology mapper class
 */
export class BrootTopologyMapper {
	private nativeWalker = new NativeWalker();
	
	constructor(
		private readonly resolveBin: () => ReturnType<typeof resolveBrootBinary> = resolveBrootBinary
	) {}
	
	/**
	 * Generate directory topology using broot or native fallback
	 */
	async topology(options: BrootOptions): Promise<BrootResult> {
		const startTime = Date.now();
		const resolvedRoot = path.resolve(options.cwd || process.cwd(), options.path);
		
		let topology: DirectoryNode[] = [];
		let method: "broot" | "native" = "native";
		let gitAware = false;
		
		// Try broot first if preferred and available
		const brootBinary = this.resolveBin();
		if ((options.preferBroot !== false) && brootBinary) {
			try {
				topology = await this.executebrootTopology(brootBinary, options);
				method = "broot";
			} catch (error) {
				console.warn("Broot execution failed, falling back to native:", error);
				// Fall through to native implementation
			}
		}
		
		// Use native walker if broot failed or not available
		if (topology.length === 0) {
			try {
				topology = await this.nativeWalker.scanDirectory(options.path, {
					maxDepth: options.depth,
					includeHidden: options.includeHidden
				});
				method = "native";
			} catch (error) {
				throw new TopologyError(
					`Both broot and native filesystem scanning failed: ${error instanceof Error ? error.message : error}`
				);
			}
		}
		
		// Apply post-processing filters
		topology = this.postProcessTopology(topology, options, resolvedRoot);
		
		// Add git status if requested
		if (options.includeGitStatus) {
			const repoRoot = gitRepoRoot(resolvedRoot);
			if (repoRoot) {
				const statusMap = porcelainStatusMap(repoRoot);
				applyGitStatus(resolvedRoot, repoRoot, statusMap, topology);
				gitAware = true;
			}
		}
		
		const scanTime = Date.now() - startTime;
		const { files, directories } = summarizeTotals(topology);
		
		return {
			topology,
			totalFiles: files,
			totalDirectories: directories,
			scanTime,
			method,
			gitAware,
			resolvedRoot
		};
	}
	
	/**
	 * Execute broot binary to get topology
	 */
	private async executebrootTopology(
		brootBinary: "br" | "broot",
		options: BrootOptions
	): Promise<DirectoryNode[]> {
		return new Promise((resolve, reject) => {
			const args = [
				"--cmd", ":print_tree",
				"--no-style", // Disable colors for easier parsing
				"--hidden" // Include hidden files (we'll filter later if needed)
			];
			
			// Add depth limit
			if (options.depth) {
				args.push("--max-depth", options.depth.toString());
			}
			
			// Add the target path
			args.push(options.path);
			
			const child = spawn(brootBinary, args, {
				cwd: options.cwd || process.cwd(),
				timeout: BROOT_TIMEOUT_MS
			});
			
			let stdout = "";
			let stderr = "";
			
			child.stdout?.on("data", (chunk) => {
				stdout += chunk.toString();
			});
			
			child.stderr?.on("data", (chunk) => {
				stderr += chunk.toString();
			});
			
			child.on("close", (code) => {
				if (code === 0) {
					const topology = topologyFromPrintTreeStdout(stdout);
					resolve(topology || []);
				} else {
					reject(new TopologyError(
						`Broot execution failed with code ${code}: ${stderr.trim()}`
					));
				}
			});
			
			child.on("error", (error) => {
				reject(new TopologyError(`Failed to spawn broot: ${error.message}`));
			});
		});
	}
	
	/**
	 * Apply post-processing filters and transformations
	 */
	private postProcessTopology(
		topology: DirectoryNode[],
		options: BrootOptions,
		resolvedRoot: string
	): DirectoryNode[] {
		let result = topology;
		
		// Apply hidden file filtering
		if (!options.includeHidden) {
			result = pruneHidden(result, false);
		}
		
		// Remove .git directories for consistency
		result = collapseDotGitSubtree(result);
		
		// Apply depth limit
		if (options.depth) {
			result = applyDepthLimit(result, options.depth);
		}
		
		// Apply type and size filters
		const typeFilters = normalizedTypeFilters(options.filterTypes);
		if (typeFilters.size > 0 || options.minSizeBytes || options.maxSizeBytes) {
			result = filterTree(result, typeFilters, options.minSizeBytes, options.maxSizeBytes);
		}
		
		return result;
	}
	
	/**
	 * Legacy API method for backward compatibility
	 */
	async map(options: BrootOptions): Promise<BrootResult> {
		return this.topology(options);
	}
}