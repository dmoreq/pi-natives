/**
 * Tests for tree filtering utilities
 */

import { describe, test, expect } from "bun:test";
import { 
	normalizedTypeFilters,
	pruneHidden,
	collapseDotGitSubtree,
	filterTree,
	applyDepthLimit,
	summarizeTotals
} from "../../src/broot/tree-filters";
import type { DirectoryNode } from "../../src/broot/types";

describe("Tree Filters", () => {
	
	const createTestNode = (name: string, kind: "file" | "directory" = "file", children?: DirectoryNode[]): DirectoryNode => ({
		name,
		relPath: name,
		kind,
		children
	});
	
	test("should normalize type filters", () => {
		const filters = normalizedTypeFilters(["dir", "files", "typescript", "JSON"]);
		
		expect(filters.has("directory")).toBe(true);
		expect(filters.has("file")).toBe(true);
		expect(filters.has("typescript")).toBe(true);
		expect(filters.has("json")).toBe(true);
		expect(filters.size).toBe(4);
	});
	
	test("should handle empty or undefined filters", () => {
		expect(normalizedTypeFilters()).toEqual(new Set());
		expect(normalizedTypeFilters([])).toEqual(new Set());
	});
	
	test("should prune hidden files", () => {
		const nodes: DirectoryNode[] = [
			createTestNode("normal.ts"),
			createTestNode(".hidden.ts"),
			createTestNode("src", "directory", [
				createTestNode("index.ts"),
				createTestNode(".env")
			])
		];
		
		const pruned = pruneHidden(nodes, false);
		
		expect(pruned).toHaveLength(2);
		expect(pruned.find(n => n.name === ".hidden.ts")).toBeUndefined();
		
		const srcDir = pruned.find(n => n.name === "src")!;
		expect(srcDir.children).toHaveLength(1);
		expect(srcDir.children![0].name).toBe("index.ts");
	});
	
	test("should keep hidden files when requested", () => {
		const nodes: DirectoryNode[] = [
			createTestNode("normal.ts"),
			createTestNode(".hidden.ts")
		];
		
		const preserved = pruneHidden(nodes, true);
		
		expect(preserved).toHaveLength(2);
		expect(preserved.find(n => n.name === ".hidden.ts")).toBeDefined();
	});
	
	test("should collapse .git subtrees", () => {
		const nodes: DirectoryNode[] = [
			createTestNode("src", "directory", [
				createTestNode("index.ts")
			]),
			createTestNode(".git", "directory", [
				createTestNode("config"),
				createTestNode("objects", "directory")
			])
		];
		
		const collapsed = collapseDotGitSubtree(nodes);
		
		expect(collapsed).toHaveLength(1);
		expect(collapsed[0].name).toBe("src");
	});
	
	test("should filter tree by type", () => {
		const nodes: DirectoryNode[] = [
			{ ...createTestNode("script.ts"), fileCategory: "code", extension: "ts" },
			{ ...createTestNode("config.json"), fileCategory: "config", extension: "json" },
			createTestNode("docs", "directory", [
				{ ...createTestNode("README.md"), fileCategory: "markup", extension: "md" }
			])
		];
		
		const codeOnly = filterTree(nodes, new Set(["code"]));
		
		expect(codeOnly).toHaveLength(1);
		expect(codeOnly[0].name).toBe("script.ts");
	});
	
	test("should filter tree by size", () => {
		const nodes: DirectoryNode[] = [
			{ ...createTestNode("small.txt"), sizeBytes: 100 },
			{ ...createTestNode("large.txt"), sizeBytes: 5000 }
		];
		
		const filtered = filterTree(nodes, new Set(), 1000, 10000);
		
		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("large.txt");
	});
	
	test("should apply depth limit", () => {
		const nodes: DirectoryNode[] = [
			createTestNode("level1", "directory", [
				createTestNode("level2", "directory", [
					createTestNode("level3", "directory", [
						createTestNode("deep.ts")
					])
				])
			])
		];
		
		const limited = applyDepthLimit(nodes, 2);
		
		const level1 = limited[0];
		const level2 = level1.children![0];
		
		expect(level2.children).toBeUndefined();
	});
	
	test("should summarize totals correctly", () => {
		const nodes: DirectoryNode[] = [
			createTestNode("file1.ts"),
			createTestNode("file2.ts"),
			createTestNode("dir1", "directory", [
				createTestNode("file3.ts"),
				createTestNode("subdir", "directory")
			])
		];
		
		const totals = summarizeTotals(nodes);
		
		expect(totals.files).toBe(3);
		expect(totals.directories).toBe(2);
	});
});