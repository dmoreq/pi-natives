/**
 * Tests for tool descriptors and registry integration
 */

import { describe, test, expect } from "bun:test";
import { 
	allToolDescriptors,
	enhancedCoreTools,
	searchTools,
	codeAnalysisTools,
	getToolsByCategory,
	getEnhancedCoreTools,
	getAnalysisTools,
	createFilteredToolSet,
	toolMetadata
} from "../src/tool-descriptors";
import { ToolCategory } from "../src/core/tool-descriptor";

describe("Tool Descriptors", () => {
	
	test("should have all required tool collections", () => {
		expect(enhancedCoreTools.length).toBeGreaterThan(0);
		expect(searchTools.length).toBeGreaterThan(0);
		expect(codeAnalysisTools.length).toBeGreaterThan(0);
		expect(allToolDescriptors.length).toBeGreaterThan(0);
	});
	
	test("should have consistent tool counts", () => {
		const expectedTotal = enhancedCoreTools.length + searchTools.length + codeAnalysisTools.length;
		expect(allToolDescriptors.length).toBe(expectedTotal);
	});
	
	test("should have valid enhanced core tools", () => {
		expect(enhancedCoreTools.length).toBe(5); // read, write, edit, shell, ls
		
		const toolIds = enhancedCoreTools.map(t => t.id);
		expect(toolIds).toContain("read-enhanced");
		expect(toolIds).toContain("write-enhanced");
		expect(toolIds).toContain("edit-enhanced");
		expect(toolIds).toContain("shell-enhanced");
		expect(toolIds).toContain("ls-enhanced");
		
		// All should be in ENHANCED_CORE category
		enhancedCoreTools.forEach(tool => {
			expect(tool.category).toBe(ToolCategory.ENHANCED_CORE);
			expect(tool.version).toBe("2.0.0");
			expect(tool.enabled).toBe(true);
		});
	});
	
	test("should have valid search tools", () => {
		expect(searchTools.length).toBe(3); // ripgrep, fd, fzf
		
		const toolIds = searchTools.map(t => t.id);
		expect(toolIds).toContain("ripgrep");
		expect(toolIds).toContain("fd");
		expect(toolIds).toContain("fzf");
		
		// All should be in SEARCH category
		searchTools.forEach(tool => {
			expect(tool.category).toBe(ToolCategory.SEARCH);
			expect(tool.version).toBe("1.0.0");
			expect(tool.enabled).toBe(true);
		});
	});
	
	test("should have valid code analysis tools", () => {
		expect(codeAnalysisTools.length).toBe(4); // semgrep, ast-grep, tokei, jscpd
		
		const toolIds = codeAnalysisTools.map(t => t.id);
		expect(toolIds).toContain("semgrep");
		expect(toolIds).toContain("ast-grep");
		expect(toolIds).toContain("tokei");
		expect(toolIds).toContain("jscpd");
		
		// All should be in CODE_ANALYSIS category
		codeAnalysisTools.forEach(tool => {
			expect(tool.category).toBe(ToolCategory.CODE_ANALYSIS);
			expect(tool.version).toBe("1.0.0");
			expect(tool.enabled).toBe(true);
		});
	});
	
	test("should have unique tool IDs", () => {
		const allIds = allToolDescriptors.map(t => t.id);
		const uniqueIds = new Set(allIds);
		
		expect(uniqueIds.size).toBe(allIds.length);
	});
	
	test("should have valid tool descriptors", () => {
		allToolDescriptors.forEach(tool => {
			// Required fields
			expect(tool.id).toBeTruthy();
			expect(tool.category).toBeTruthy();
			expect(tool.registerFn).toBeTruthy();
			expect(tool.promptFile).toBeTruthy();
			expect(tool.version).toBeTruthy();
			expect(tool.enabled).toBeDefined();
			
			// Prompt file should be a path
			expect(tool.promptFile).toMatch(/\.md$/);
			expect(tool.promptFile).toMatch(/^prompts\//);
			
			// Category should be valid
			expect(Object.values(ToolCategory)).toContain(tool.category);
		});
	});
	
	test("should filter tools by category correctly", () => {
		const enhancedCore = getToolsByCategory(ToolCategory.ENHANCED_CORE);
		const search = getToolsByCategory(ToolCategory.SEARCH);
		const codeAnalysis = getToolsByCategory(ToolCategory.CODE_ANALYSIS);
		
		expect(enhancedCore).toEqual(enhancedCoreTools);
		expect(search).toEqual(searchTools);
		expect(codeAnalysis).toEqual(codeAnalysisTools);
		
		// Empty categories should return empty arrays
		const fileOps = getToolsByCategory(ToolCategory.FILE_OPS);
		const utility = getToolsByCategory(ToolCategory.UTILITY);
		
		expect(fileOps).toEqual([]);
		expect(utility).toEqual([]);
	});
	
	test("should get enhanced core tools correctly", () => {
		const enhanced = getEnhancedCoreTools();
		expect(enhanced).toEqual(enhancedCoreTools);
		expect(enhanced.length).toBe(5);
	});
	
	test("should get analysis tools correctly", () => {
		const analysis = getAnalysisTools();
		const expectedLength = searchTools.length + codeAnalysisTools.length;
		
		expect(analysis.length).toBe(expectedLength);
		
		// Should contain all search tools
		searchTools.forEach(tool => {
			expect(analysis).toContain(tool);
		});
		
		// Should contain all code analysis tools
		codeAnalysisTools.forEach(tool => {
			expect(analysis).toContain(tool);
		});
	});
	
	test("should filter tools by binary availability", () => {
		// All binaries available
		const allBinaries = new Set([
			'rg', 'fd', 'fzf', 'semgrep', 'ast-grep', 'tokei', 'jscpd',
			'jq', 'yq', 'bat', 'nu', 'br', 'broot'
		]);
		
		const allAvailable = createFilteredToolSet(allBinaries);
		expect(allAvailable.length).toBe(allToolDescriptors.length);
		
		// Only basic binaries available
		const basicBinaries = new Set(['rg', 'fd', 'fzf']);
		const basicFiltered = createFilteredToolSet(basicBinaries);
		
		// Should include tools with no requirements and tools with only available requirements
		expect(basicFiltered.length).toBeGreaterThan(0);
		expect(basicFiltered.length).toBeLessThan(allToolDescriptors.length);
		
		// Write-enhanced should be included (no required binaries)
		expect(basicFiltered.some(t => t.id === 'write-enhanced')).toBe(true);
		
		// Ripgrep should be included (rg is available)
		expect(basicFiltered.some(t => t.id === 'ripgrep')).toBe(true);
		
		// No binaries available
		const noBinaries = new Set<string>();
		const minimal = createFilteredToolSet(noBinaries);
		
		// Should only include tools with no required binaries
		expect(minimal.length).toBeGreaterThan(0);
		expect(minimal.every(tool => {
			const requiredBinaries = tool.binaries?.filter(b => b.required) || [];
			return requiredBinaries.length === 0;
		})).toBe(true);
	});
	
	test("should have accurate metadata", () => {
		expect(toolMetadata.totalTools).toBe(allToolDescriptors.length);
		expect(toolMetadata.enhancedCoreCount).toBe(enhancedCoreTools.length);
		expect(toolMetadata.searchToolCount).toBe(searchTools.length);
		expect(toolMetadata.analysisToolCount).toBe(codeAnalysisTools.length);
		
		// Binary counts should be reasonable
		expect(toolMetadata.totalBinaries).toBeGreaterThan(0);
		expect(toolMetadata.requiredBinaries).toBeGreaterThan(0);
		expect(toolMetadata.optionalBinaries).toBeGreaterThanOrEqual(0);
		
		// Total should be sum of required and optional
		expect(toolMetadata.totalBinaries).toBeGreaterThanOrEqual(
			Math.max(toolMetadata.requiredBinaries, toolMetadata.optionalBinaries)
		);
	});
	
	test("should have proper binary dependencies", () => {
		const toolsWithBinaries = allToolDescriptors.filter(t => t.binaries && t.binaries.length > 0);
		expect(toolsWithBinaries.length).toBeGreaterThan(0);
		
		toolsWithBinaries.forEach(tool => {
			tool.binaries!.forEach(binary => {
				expect(binary.binary).toBeTruthy();
				expect(binary.label).toBeTruthy();
				expect(binary.installCommand).toBeTruthy();
				expect(binary.required).toBeDefined();
			});
		});
	});
	
	test("should maintain category distribution", () => {
		// Enhanced core tools should be the most important
		expect(enhancedCoreTools.length).toBeGreaterThanOrEqual(3);
		
		// Should have reasonable distribution
		expect(searchTools.length).toBeGreaterThanOrEqual(2);
		expect(codeAnalysisTools.length).toBeGreaterThanOrEqual(3);
		
		// Total should not be excessive
		expect(allToolDescriptors.length).toBeLessThan(20); // Keep manageable
	});
});