/**
 * Tree filtering and manipulation utilities
 * 
 * Functions for pruning, filtering, and transforming directory trees.
 */

import type { DirectoryNode } from "./types";

/**
 * Normalize type filters, expanding aliases
 */
export function normalizedTypeFilters(filters?: string[]): Set<string> {
	if (!filters || filters.length === 0) return new Set();
	
	const normalized = new Set<string>();
	
	for (const filter of filters) {
		let t = filter.trim().toLowerCase();
		if (!t) continue;
		
		// Expand common aliases
		if (t === "dir") t = "directory";
		if (t === "files") t = "file";
		
		// Remove leading dots for extensions
		t = t.replace(/^\.+/, "");
		
		normalized.add(t);
	}
	
	return normalized;
}

/**
 * Check if a leaf node matches the given filters
 */
function leafMatches(filters: Set<string>, node: DirectoryNode): boolean {
	if (filters.size === 0) return true;
	
	// Check node kind
	if (filters.has(node.kind)) return true;
	
	// Check file category
	if (node.fileCategory && filters.has(node.fileCategory)) return true;
	
	// Check extension
	if (node.extension && filters.has(node.extension)) return true;
	
	return false;
}

/**
 * Remove dot-names when agents opt out — native scan skips them early; broot ASCII may include them
 */
export function pruneHidden(nodes: DirectoryNode[], includeHidden: boolean): DirectoryNode[] {
	if (includeHidden) return nodes;
	
	return nodes
		.filter(node => !node.name.startsWith("."))
		.map(node => ({
			...node,
			children: node.children ? pruneHidden(node.children, includeHidden) : undefined
		}));
}

/**
 * Native walker never traverses `.git`; strip broot internals for parity
 */
export function collapseDotGitSubtree(nodes: DirectoryNode[]): DirectoryNode[] {
	return nodes
		.filter(node => node.name !== ".git")
		.map(node => ({
			...node,
			children: node.children ? collapseDotGitSubtree(node.children) : undefined
		}));
}

/**
 * Limit tree depth recursively
 */
function limitTopologyDepth(nodes: DirectoryNode[], maxDepth: number, currentDepth = 1): void {
	for (const node of nodes) {
		if (currentDepth >= maxDepth) {
			// At max depth, remove children
			delete node.children;
		} else if (node.children) {
			// Continue recursively
			limitTopologyDepth(node.children, maxDepth, currentDepth + 1);
		}
	}
}

/**
 * Filter tree by type filters and size constraints
 */
export function filterTree(
	nodes: DirectoryNode[], 
	filters: Set<string>, 
	minSizeBytes?: number, 
	maxSizeBytes?: number
): DirectoryNode[] {
	const filtered: DirectoryNode[] = [];
	
	for (const node of nodes) {
		// Check size constraints for files
		if (node.kind === "file" && node.sizeBytes !== undefined) {
			if (minSizeBytes !== undefined && node.sizeBytes < minSizeBytes) continue;
			if (maxSizeBytes !== undefined && node.sizeBytes > maxSizeBytes) continue;
		}
		
		// Recursively filter children first
		const filteredChildren = node.children 
			? filterTree(node.children, filters, minSizeBytes, maxSizeBytes)
			: undefined;
		
		// Include node if:
		// 1. It matches the filters directly, OR
		// 2. It's a directory with matching children
		const nodeMatches = leafMatches(filters, node);
		const hasMatchingChildren = filteredChildren && filteredChildren.length > 0;
		
		if (nodeMatches || hasMatchingChildren) {
			filtered.push({
				...node,
				children: filteredChildren
			});
		}
	}
	
	return filtered;
}

/**
 * Apply depth limit to topology
 */
export function applyDepthLimit(nodes: DirectoryNode[], maxDepth?: number): DirectoryNode[] {
	if (!maxDepth || maxDepth <= 0) return nodes;
	
	const limited = JSON.parse(JSON.stringify(nodes)); // Deep clone
	limitTopologyDepth(limited, maxDepth);
	return limited;
}

/**
 * Count total files and directories in tree
 */
export function summarizeTotals(nodes: DirectoryNode[]): { files: number; directories: number } {
	let files = 0;
	let directories = 0;
	
	function count(nodes: DirectoryNode[]): void {
		for (const node of nodes) {
			if (node.kind === "file") {
				files++;
			} else if (node.kind === "directory") {
				directories++;
			}
			
			if (node.children) {
				count(node.children);
			}
		}
	}
	
	count(nodes);
	return { files, directories };
}