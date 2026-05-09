/**
 * Git integration for broot topology
 * 
 * Adds git status information to directory nodes when available.
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import type { DirectoryNode } from "./types";

/**
 * Convert path to POSIX format for consistent git status mapping
 */
function posixKey(p: string): string {
	return p.replace(/\\/g, "/");
}

/**
 * Find the git repository root for a given path
 */
export function gitRepoRoot(absPath: string): string | null {
	try {
		const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
			cwd: absPath,
			encoding: "utf8",
			timeout: 5000
		});
		
		if (result.status === 0 && result.stdout.trim()) {
			return result.stdout.trim();
		}
	} catch {
		// Git not available or not a git repo
	}
	
	return null;
}

/**
 * Get git status map using porcelain format
 */
export function porcelainStatusMap(repoRootAbs: string): Map<string, string> {
	const statusMap = new Map<string, string>();
	
	try {
		const result = spawnSync("git", ["status", "--porcelain=v1"], {
			cwd: repoRootAbs,
			encoding: "utf8",
			timeout: 10000
		});
		
		if (result.status === 0) {
			const lines = result.stdout.split("\n");
			
			for (const line of lines) {
				if (line.length < 4) continue;
				
				const status = line.slice(0, 2);
				const filePath = line.slice(3);
				
				// Handle renamed files (format: "old -> new")
				const actualPath = filePath.includes(" -> ") 
					? filePath.split(" -> ")[1] 
					: filePath;
				
				// Remove quotes if present
				const cleanPath = actualPath.replace(/^"(.*)"$/, "$1");
				const posixPath = posixKey(cleanPath);
				
				statusMap.set(posixPath, status);
			}
		}
	} catch {
		// Git command failed, return empty map
	}
	
	return statusMap;
}

/**
 * Apply git status information to directory nodes
 */
export function applyGitStatus(
	scanRootAbs: string,
	repoRootAbs: string | null,
	statusMap: Map<string, string>,
	nodes: DirectoryNode[]
): void {
	if (!repoRootAbs || statusMap.size === 0) return;
	
	const scanRootKey = posixKey(path.relative(repoRootAbs, scanRootAbs));
	
	forEachNode(nodes, (node) => {
		// Construct the full relative path from repo root
		const nodeRepoPath = scanRootKey 
			? `${scanRootKey}/${node.relPath}` 
			: node.relPath;
		
		const posixNodePath = posixKey(nodeRepoPath);
		
		// Check for exact match or parent directory status
		const status = statusMap.get(posixNodePath);
		if (status) {
			node.gitStatus = status;
		} else {
			// Check if any file in this directory has status (for directories)
			if (node.kind === "directory") {
				for (const [statusPath, statusCode] of statusMap.entries()) {
					if (statusPath.startsWith(posixNodePath + "/")) {
						node.gitStatus = "M "; // Mark directory as modified if contains changes
						break;
					}
				}
			}
		}
	});
}

/**
 * Utility to traverse all nodes in a tree
 */
function forEachNode(nodes: DirectoryNode[], fn: (node: DirectoryNode) => void): void {
	for (const node of nodes) {
		fn(node);
		if (node.children) {
			forEachNode(node.children, fn);
		}
	}
}