/**
 * Integration test demonstrating the complete tool registry system
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ToolRegistry } from "../../src/core/tool-registry";
import { BinaryManager } from "../../src/core/binary-manager";
import { allToolDescriptors } from "../../src/tool-descriptors";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

describe("Tool Registry Integration", () => {
	let registry: ToolRegistry;
	let binaryManager: BinaryManager;
	let mockApi: ExtensionAPI;
	let mockContext: ExtensionContext;
	
	beforeEach(() => {
		// Setup binary manager with test overrides
		binaryManager = new BinaryManager({ showNotifications: false });
		
		// Override all binaries as available for testing
		binaryManager.setBinaryOverride('rg', true);
		binaryManager.setBinaryOverride('fd', true);
		binaryManager.setBinaryOverride('fzf', true);
		binaryManager.setBinaryOverride('semgrep', true);
		binaryManager.setBinaryOverride('ast-grep', true);
		binaryManager.setBinaryOverride('tokei', true);
		binaryManager.setBinaryOverride('jscpd', true);
		binaryManager.setBinaryOverride('jq', true);
		binaryManager.setBinaryOverride('yq', true);
		binaryManager.setBinaryOverride('bat', true);
		binaryManager.setBinaryOverride('nu', true);
		binaryManager.setBinaryOverride('br', true);
		
		registry = new ToolRegistry(binaryManager);
		
		// Mock ExtensionAPI
		const registeredTools: Array<{ name: string; description: string }> = [];
		mockApi = {
			registerTool: (toolConfig: any) => {
				registeredTools.push({
					name: toolConfig.name,
					description: toolConfig.description || 'No description'
				});
			}
		} as any;
		
		// Mock ExtensionContext
		const notifications: Array<{ message: string; type: string }> = [];
		mockContext = {
			ui: {
				notify: (message: string, type: string = 'info') => {
					notifications.push({ message, type });
				}
			}
		} as any;
		
		// Expose mocks for test access
		(mockApi as any)._registeredTools = registeredTools;
		(mockContext as any)._notifications = notifications;
	});
	
	test("should register all tool descriptors successfully", async () => {
		// Register all tool descriptors
		registry.registerAll(allToolDescriptors);
		
		// Verify all tools are registered in the registry
		expect(registry.getAllTools()).toHaveLength(allToolDescriptors.length);
		
		// Load and register with ExtensionAPI
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		// Verify statistics
		expect(stats.totalTools).toBe(allToolDescriptors.length);
		expect(stats.failures).toHaveLength(0);
		expect(stats.registrationTime).toBeGreaterThan(0);
		
		// Verify all tools were registered with the mock API
		const registeredTools = (mockApi as any)._registeredTools;
		expect(registeredTools).toHaveLength(allToolDescriptors.length);
		
		// Verify expected tool names are registered
		const toolNames = registeredTools.map((t: any) => t.name);
		expect(toolNames).toContain('read_enhanced');
		expect(toolNames).toContain('write_enhanced');
		expect(toolNames).toContain('edit_enhanced');
		expect(toolNames).toContain('shell_enhanced');
		expect(toolNames).toContain('ls_enhanced');
		expect(toolNames).toContain('ripgrep');
		expect(toolNames).toContain('find_files');
		expect(toolNames).toContain('fuzzy_find');
		expect(toolNames).toContain('semgrep');
		expect(toolNames).toContain('ast_grep');
		expect(toolNames).toContain('count_lines');
		expect(toolNames).toContain('find_duplicates');
	});
	
	test("should handle missing binaries gracefully", async () => {
		// Clear binary overrides to simulate missing binaries
		binaryManager.clearOverrides();
		
		registry.registerAll(allToolDescriptors);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		// Should still register tools (binaries are optional or fallbacks exist)
		expect(stats.totalTools).toBeGreaterThan(0);
		
		// May or may not report missing binaries depending on system
		// Just verify the mechanism works without specific count expectations
		expect(stats.missingBinaries).toBeDefined();
	});
	
	test("should respect category filtering", async () => {
		registry.registerAll(allToolDescriptors);
		
		// Register only enhanced core tools
		const coreStats = await registry.loadAndRegisterAll(mockApi, mockContext, {
			categories: ['enhanced-core']
		});
		
		expect(coreStats.totalTools).toBe(5); // 5 enhanced core tools
		
		const registeredTools = (mockApi as any)._registeredTools;
		const toolNames = registeredTools.map((t: any) => t.name);
		
		// Should contain enhanced tools
		expect(toolNames).toContain('read_enhanced');
		expect(toolNames).toContain('write_enhanced');
		
		// Should not contain search tools
		expect(toolNames).not.toContain('ripgrep');
		expect(toolNames).not.toContain('find_files');
	});
	
	test("should handle binary dependency chains correctly", async () => {
		registry.registerAll(allToolDescriptors);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		// Verify binary manager statistics
		const allBinaries = allToolDescriptors.flatMap(t => t.binaries || []);
		const binaryStats = binaryManager.getStats(allBinaries);
		
		expect(binaryStats.total).toBeGreaterThan(0);
		expect(binaryStats.available).toBeGreaterThan(0);
	});
	
	test("should provide comprehensive tool metadata", async () => {
		registry.registerAll(allToolDescriptors);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		// Verify category distribution
		const enhancedCount = stats.byCategory.get('enhanced-core') || 0;
		const searchCount = stats.byCategory.get('search') || 0;
		const analysisCount = stats.byCategory.get('code-analysis') || 0;
		
		expect(enhancedCount).toBe(5);
		expect(searchCount).toBe(3);
		expect(analysisCount).toBe(4);
		
		// Total should match
		expect(enhancedCount + searchCount + analysisCount).toBe(stats.totalTools);
	});
	
	test("should demonstrate performance benefits", async () => {
		registry.registerAll(allToolDescriptors);
		
		// First registration (cold)
		const start1 = Date.now();
		await registry.loadAndRegisterAll(mockApi, mockContext);
		const duration1 = Date.now() - start1;
		
		// Clear and re-register (warm - should be faster due to caching)
		(mockApi as any)._registeredTools.length = 0;
		registry.clear();
		registry.registerAll(allToolDescriptors);
		
		const start2 = Date.now();
		await registry.loadAndRegisterAll(mockApi, mockContext);
		const duration2 = Date.now() - start2;
		
		// Both should be reasonably fast
		expect(duration1).toBeLessThan(1000); // Less than 1 second
		expect(duration2).toBeLessThan(1000);
		
		// Second run should benefit from binary checking cache
		console.log(`Registration times - Cold: ${duration1}ms, Warm: ${duration2}ms`);
	});
});