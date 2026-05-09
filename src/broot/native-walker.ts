/**
 * Native filesystem walker as fallback for broot
 * 
 * Provides equivalent functionality when broot binary is not available.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { DirectoryNode, DirectoryKind } from "./types";
import { classifyNode } from "./file-classifier";

/**
 * Native filesystem walker that mimics broot behavior
 */
export class NativeWalker {
	/**
	 * Scan directory recursively with native filesystem APIs
	 */
	async scanDirectory(
		rootPath: string,
		options: {
			maxDepth?: number;
			includeHidden?: boolean;
		} = {}
	): Promise<DirectoryNode[]> {
		const { maxDepth = 10, includeHidden = false } = options;
		
		const absolutePath = path.resolve(rootPath);
		
		// Check if path exists and is a directory
		try {
			const stats = await fs.stat(absolutePath);
			if (!stats.isDirectory()) {
				throw new Error(`Path is not a directory: ${rootPath}`);
			}
		} catch (error) {
			throw new Error(`Failed to access directory '${rootPath}': ${error instanceof Error ? error.message : error}`);
		}
		
		try {
			const entries = await this.walkRecursive(absolutePath, absolutePath, maxDepth, includeHidden, 1);
			return entries;
		} catch (error) {
			throw new Error(`Failed to scan directory '${rootPath}': ${error instanceof Error ? error.message : error}`);
		}
	}
	
	/**
	 * Recursive directory walking implementation
	 */
	private async walkRecursive(
		currentPath: string,
		rootPath: string,
		maxDepth: number,
		includeHidden: boolean,
		currentDepth: number
	): Promise<DirectoryNode[]> {
		const results: DirectoryNode[] = [];
		
		if (currentDepth > maxDepth) {
			return results;
		}
		
		try {
			const entries = await fs.readdir(currentPath, { withFileTypes: true });
			
			for (const entry of entries) {
				// Skip hidden files/directories if not requested
				if (!includeHidden && entry.name.startsWith(".")) {
					continue;
				}
				
				// Skip .git directory for consistency with broot behavior
				if (entry.name === ".git") {
					continue;
				}
				
				const fullPath = path.join(currentPath, entry.name);
				const relativePath = path.relative(rootPath, fullPath);
				const posixRelPath = relativePath.replace(/\\/g, "/");
				
				let kind: DirectoryKind;
				if (entry.isSymbolicLink()) {
					kind = "symlink";
				} else if (entry.isDirectory()) {
					kind = "directory";
				} else {
					kind = "file";
				}
				
				const node: DirectoryNode = {
					name: entry.name,
					relPath: posixRelPath,
					kind,
					...classifyNode(entry.name, kind)
				};
				
				// Get file size for files
				if (kind === "file") {
					try {
						const stats = await fs.stat(fullPath);
						node.sizeBytes = stats.size;
					} catch {
						// If we can't get size, continue without it
					}
				}
				
				// Recursively scan directories
				if (kind === "directory" && currentDepth < maxDepth) {
					try {
						const children = await this.walkRecursive(
							fullPath,
							rootPath,
							maxDepth,
							includeHidden,
							currentDepth + 1
						);
						node.children = children;
					} catch {
						// If we can't read directory, include it without children
						node.children = [];
					}
				}
				
				results.push(node);
			}
		} catch (error) {
			// If we can't read the current directory, return empty results
			console.warn(`Failed to read directory '${currentPath}':`, error);
		}
		
		// Sort results: directories first, then files, both alphabetically
		results.sort((a, b) => {
			if (a.kind === "directory" && b.kind !== "directory") return -1;
			if (a.kind !== "directory" && b.kind === "directory") return 1;
			return a.name.localeCompare(b.name);
		});
		
		return results;
	}
}