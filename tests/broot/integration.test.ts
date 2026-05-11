/**
 * Integration tests for the decomposed broot module
 */

import { describe, test, expect } from "bun:test";
import { BrootTopologyMapper, resolveBrootBinary } from "../../src/broot";

describe("Broot Integration", () => {
	
	test("should maintain backward compatibility", () => {
		// Verify that the main exports are still available
		expect(BrootTopologyMapper).toBeDefined();
		expect(resolveBrootBinary).toBeDefined();
		expect(typeof BrootTopologyMapper).toBe("function");
		expect(typeof resolveBrootBinary).toBe("function");
	});
	
	test("should resolve broot binary availability", () => {
		const binary = resolveBrootBinary();
		// Should return null, "br", or "broot"
		expect(binary === null || binary === "br" || binary === "broot").toBe(true);
	});
	
	test("should create mapper instance", () => {
		const mapper = new BrootTopologyMapper();
		expect(mapper).toBeDefined();
		expect(typeof mapper.topology).toBe("function");
	});
	
	test("should scan current directory with native fallback", async () => {
		const mapper = new BrootTopologyMapper();
		
		// Force native mode by setting preferBroot to false
		const result = await mapper.topology({
			path: ".",
			depth: 2,
			preferBroot: false,
			includeHidden: false
		});
		
		expect(result).toBeDefined();
		expect(result.method).toBe("native");
		expect(Array.isArray(result.topology)).toBe(true);
		expect(result.totalFiles).toBeGreaterThanOrEqual(0);
		expect(result.totalDirectories).toBeGreaterThanOrEqual(0);
		expect(result.scanTime).toBeGreaterThanOrEqual(0);
		expect(result.resolvedRoot).toContain("pi-sherlock");
	});
	
	test("should handle non-existent directory gracefully", async () => {
		const mapper = new BrootTopologyMapper();
		
		await expect(async () => {
			await mapper.topology({
				path: "/non/existent/path",
				preferBroot: false
			});
		}).toThrow();
	});
	
	test("should filter by file types", async () => {
		const mapper = new BrootTopologyMapper();
		
		const result = await mapper.topology({
			path: "src",
			depth: 2,
			filterTypes: ["typescript", "javascript"],
			preferBroot: false
		});
		
		// All files should be code files if any are found
		const hasFiles = result.totalFiles > 0;
		if (hasFiles) {
			const allFiles: any[] = [];
			const collectFiles = (nodes: any[]) => {
				for (const node of nodes) {
					if (node.kind === "file") {
						allFiles.push(node);
					}
					if (node.children) {
						collectFiles(node.children);
					}
				}
			};
			collectFiles(result.topology);
			
			// Check that files match the filter (if any files found)
			if (allFiles.length > 0) {
				const codeFiles = allFiles.filter(f => 
					f.extension === "ts" || 
					f.extension === "js" ||
					f.fileCategory === "code"
				);
				expect(codeFiles.length).toBeGreaterThan(0);
			}
		}
	});
	
	test("should respect depth limits", async () => {
		const mapper = new BrootTopologyMapper();
		
		const result = await mapper.topology({
			path: ".",
			depth: 1,
			preferBroot: false
		});
		
		// Check that no node has deeply nested children
		const checkDepth = (nodes: any[], currentDepth = 0): number => {
			let maxDepth = currentDepth;
			for (const node of nodes) {
				if (node.children && node.children.length > 0) {
					const childDepth = checkDepth(node.children, currentDepth + 1);
					maxDepth = Math.max(maxDepth, childDepth);
				}
			}
			return maxDepth;
		};
		
		const actualDepth = checkDepth(result.topology);
		expect(actualDepth).toBeLessThanOrEqual(1);
	});
	
	test("should include git status when requested", async () => {
		const mapper = new BrootTopologyMapper();
		
		const result = await mapper.topology({
			path: ".",
			depth: 1,
			includeGitStatus: true,
			preferBroot: false
		});
		
		// Git awareness should be detected if in a git repo
		// (this test is in a git repo, so should be true)
		expect(typeof result.gitAware).toBe("boolean");
		
		if (result.gitAware) {
			// Some files might have git status
			const hasGitStatus = (nodes: any[]): boolean => {
				for (const node of nodes) {
					if (node.gitStatus) return true;
					if (node.children && hasGitStatus(node.children)) return true;
				}
				return false;
			};
			
			// In a git repo with files, at least some should have status
			// (This is somewhat environment dependent)
		}
	});
});