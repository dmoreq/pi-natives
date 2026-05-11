/**
 * Broot ASCII output parser
 * 
 * Parses the `:print_tree` command output from broot into structured topology.
 */

import type { DirectoryNode, ParsedTreeRow } from "./types";
import { classifyNode } from "./file-classifier";

const ansiRe = /\u001b\[[\d;]*m/g;

/**
 * Strip ANSI color codes from string
 */
function stripAnsi(s: string): string {
	return s.replace(ansiRe, "");
}

/**
 * Strip trailing size/count annotations like " (15.2K)" from broot output
 */
function stripTrailingAnnotation(name: string): string {
	// Remove patterns like " (15.2K)", " [12 files]", etc.
	return name.replace(/\s+[\[\(][^)\]]*[\]\)]$/g, "").trim();
}

/**
 * Parse `:print_tree` output into indentation rows for tests/broot integration
 */
export function parsePrintTreeRows(stdout: string): ParsedTreeRow[] {
	const lines = stdout.split("\n");
	const rows: ParsedTreeRow[] = [];
	
	for (const line of lines) {
		if (line.trim().length === 0) continue;
		
		const clean = stripAnsi(line);
		
		// Skip the root line (first line without tree symbols)
		if (!clean.includes("├") && !clean.includes("└") && !clean.includes("│")) {
			continue;
		}
		
		// Extract tree structure and name
		const match = clean.match(/^(\s*)(├──|└──|│\s+├──|│\s+└──)\s*(.*)$/);
		if (!match) continue;
		
		const [, whitespace, treeSymbol, nameWithAnnotation] = match;
		const indentation = whitespace || "";
		
		// Calculate depth based on tree symbols
		// Count the number of │ symbols to determine nesting level
		const pipeCount = (clean.match(/│/g) || []).length;
		const depth = pipeCount + 1;
		
		const name = stripTrailingAnnotation(nameWithAnnotation.trim());
		
		if (name.length > 0) {
			rows.push({ depth, name, indentation });
		}
	}
	
	return rows;
}

/**
 * Convert parsed rows into a nested directory structure
 */
function rowsToTopology(rows: ParsedTreeRow[]): DirectoryNode[] | null {
	if (rows.length === 0) return null;
	
	const root: DirectoryNode[] = [];
	const stack: DirectoryNode[] = [];
	
	for (const row of rows) {
		const { depth, name } = row;
		
		// Determine if this is a directory (common broot conventions)
		const isDirectory = name.endsWith("/") || 
		                   name.includes(" files]") ||
		                   !name.includes(".");
		
		const cleanName = name.replace(/\/$/, ""); // Remove trailing slash
		const kind = isDirectory ? "directory" : "file";
		
		const node: DirectoryNode = {
			name: cleanName,
			relPath: cleanName, // Will be updated with full path later
			kind,
			...classifyNode(cleanName, kind)
		};
		
		// If it's a directory, initialize children array
		if (kind === "directory") {
			node.children = [];
		}
		
		// Trim stack to appropriate depth
		while (stack.length > depth) {
			stack.pop();
		}
		
		// Add to parent or root
		if (stack.length === 0) {
			root.push(node);
		} else {
			const parent = stack[stack.length - 1];
			if (parent.children) {
				parent.children.push(node);
			}
		}
		
		// Add to stack if it's a directory (can have children)
		if (kind === "directory") {
			stack.push(node);
		}
	}
	
	return root;
}

/**
 * Ensure relative paths are properly constructed from the tree structure
 */
function sanitizeRelPaths(nodes: DirectoryNode[], basePath = ""): boolean {
	let hasChanges = false;
	
	for (const node of nodes) {
		const expectedPath = basePath ? `${basePath}/${node.name}` : node.name;
		
		if (node.relPath !== expectedPath) {
			node.relPath = expectedPath;
			hasChanges = true;
		}
		
		if (node.children) {
			if (sanitizeRelPaths(node.children, expectedPath)) {
				hasChanges = true;
			}
		}
	}
	
	return hasChanges;
}

/**
 * Main function to parse broot `:print_tree` output into topology
 */
export function topologyFromPrintTreeStdout(stdout: string): DirectoryNode[] | null {
	const rows = parsePrintTreeRows(stdout);
	if (rows.length === 0) return null;
	
	const topology = rowsToTopology(rows);
	if (!topology) return null;
	
	// Ensure relative paths are correct
	sanitizeRelPaths(topology);
	
	return topology;
}