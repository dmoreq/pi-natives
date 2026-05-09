/**
 * Tests for the Tool Registry System
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ToolRegistry } from "../../src/core/tool-registry";
import { BinaryManager } from "../../src/core/binary-manager";
import type { ToolDescriptor, ToolCategory } from "../../src/core/tool-descriptor";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ToolRegistry", () => {
	let registry: ToolRegistry;
	let binaryManager: BinaryManager;
	let mockApi: ExtensionAPI;
	let mockContext: ExtensionContext;
	let tempDir: string;
	
	beforeEach(() => {
		binaryManager = new BinaryManager({ showNotifications: false });
		registry = new ToolRegistry(binaryManager);
		
		// Create temp directory for test prompt files
		tempDir = join(tmpdir(), `tool-registry-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
		
		// Mock ExtensionAPI
		const registeredTools: string[] = [];
		mockApi = {
			registerTool: (toolConfig: any) => {
				registeredTools.push(toolConfig.name);
			}
		} as any;
		
		// Mock ExtensionContext
		const notifications: Array<{message: string, type: string}> = [];
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
	
	afterEach(() => {
		// Cleanup temp directory
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});
	
	const createTestDescriptor = (
		id: string, 
		overrides: Partial<ToolDescriptor> = {}
	): ToolDescriptor => {
		// Create test prompt file
		const promptFile = join(tempDir, `${id}.md`);
		writeFileSync(promptFile, `# Test prompt for ${id}`);
		
		return {
			id,
			category: 'search' as ToolCategory,
			registerFn: (api: ExtensionAPI, description: string) => {
				api.registerTool({
					name: id,
					description,
					execute: async () => ({ content: [], details: {} })
				} as any);
			},
			promptFile,
			enabled: true,
			...overrides
		};
	};
	
	test("should register and retrieve tools", () => {
		const tool1 = createTestDescriptor("test-tool-1");
		const tool2 = createTestDescriptor("test-tool-2");
		
		registry.register(tool1);
		registry.register(tool2);
		
		expect(registry.hasTool("test-tool-1")).toBe(true);
		expect(registry.hasTool("test-tool-2")).toBe(true);
		expect(registry.hasTool("non-existent")).toBe(false);
		
		const retrieved = registry.getTool("test-tool-1");
		expect(retrieved).toEqual(tool1);
		
		const allTools = registry.getAllTools();
		expect(allTools).toHaveLength(2);
		expect(allTools.map(t => t.id)).toContain("test-tool-1");
		expect(allTools.map(t => t.id)).toContain("test-tool-2");
	});
	
	test("should prevent duplicate tool registration", () => {
		const tool = createTestDescriptor("duplicate-tool");
		
		registry.register(tool);
		
		expect(() => registry.register(tool)).toThrow("Tool 'duplicate-tool' is already registered");
	});
	
	test("should filter tools by category", () => {
		const searchTool = createTestDescriptor("search-tool", { 
			category: 'search' as ToolCategory 
		});
		const fileOpsTool = createTestDescriptor("file-ops-tool", { 
			category: 'file-ops' as ToolCategory 
		});
		
		registry.register(searchTool);
		registry.register(fileOpsTool);
		
		const searchTools = registry.getToolsByCategory('search' as ToolCategory);
		const fileOpsTools = registry.getToolsByCategory('file-ops' as ToolCategory);
		
		expect(searchTools).toHaveLength(1);
		expect(searchTools[0].id).toBe("search-tool");
		
		expect(fileOpsTools).toHaveLength(1);
		expect(fileOpsTools[0].id).toBe("file-ops-tool");
	});
	
	test("should validate tool descriptors", () => {
		expect(() => {
			registry.register({} as ToolDescriptor);
		}).toThrow("Tool descriptor must have an id");
		
		expect(() => {
			registry.register({ id: "test" } as ToolDescriptor);
		}).toThrow("Tool 'test' must have a registerFn");
		
		expect(() => {
			registry.register({
				id: "test",
				registerFn: () => {},
			} as ToolDescriptor);
		}).toThrow("Tool 'test' must have a promptFile");
		
		expect(() => {
			registry.register({
				id: "test",
				registerFn: () => {},
				promptFile: "test.md",
				category: "invalid" as ToolCategory
			});
		}).toThrow("Tool 'test' has invalid category: invalid");
	});
	
	test("should handle tool dependencies", async () => {
		const baseTool = createTestDescriptor("base-tool");
		const dependentTool = createTestDescriptor("dependent-tool", {
			dependencies: ["base-tool"]
		});
		
		registry.register(baseTool);
		registry.register(dependentTool);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		expect(stats.totalTools).toBe(2);
		expect(stats.failures).toHaveLength(0);
		
		// Check that tools were registered in dependency order
		const registeredTools = (mockApi as any)._registeredTools as string[];
		const baseIndex = registeredTools.indexOf("base-tool");
		const dependentIndex = registeredTools.indexOf("dependent-tool");
		
		expect(baseIndex).toBeLessThan(dependentIndex);
	});
	
	test("should fail registration with missing dependencies", async () => {
		const dependentTool = createTestDescriptor("dependent-tool", {
			dependencies: ["missing-tool"]
		});
		
		registry.register(dependentTool);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		expect(stats.totalTools).toBe(0);
		expect(stats.failures).toHaveLength(1);
		expect(stats.failures[0].error).toContain("Missing dependencies: missing-tool");
	});
	
	test("should detect circular dependencies", async () => {
		const tool1 = createTestDescriptor("tool-1", {
			dependencies: ["tool-2"]
		});
		const tool2 = createTestDescriptor("tool-2", {
			dependencies: ["tool-1"]
		});
		
		registry.register(tool1);
		registry.register(tool2);
		
		await expect(async () => {
			await registry.loadAndRegisterAll(mockApi, mockContext);
		}).toThrow("Circular dependency detected");
	});
	
	test("should handle registration options", async () => {
		const searchTool = createTestDescriptor("search-tool", { 
			category: 'search' as ToolCategory 
		});
		const fileOpsTool = createTestDescriptor("file-ops-tool", { 
			category: 'file-ops' as ToolCategory 
		});
		const disabledTool = createTestDescriptor("disabled-tool", {
			category: 'utility' as ToolCategory
		});
		
		registry.register(searchTool);
		registry.register(fileOpsTool);
		registry.register(disabledTool);
		
		// Test category filtering
		const searchOnlyStats = await registry.loadAndRegisterAll(mockApi, mockContext, {
			categories: ['search' as ToolCategory]
		});
		
		expect(searchOnlyStats.totalTools).toBe(1);
		
		// Clear registry and re-register for second test
		registry.clear();
		registry.register(searchTool);
		registry.register(fileOpsTool);
		registry.register(disabledTool);
		
		(mockApi as any)._registeredTools.length = 0;
		
		const notDisabledStats = await registry.loadAndRegisterAll(mockApi, mockContext, {
			disabledTools: ['disabled-tool']
		});
		
		expect(notDisabledStats.totalTools).toBe(2); // search-tool + file-ops-tool
	});
	
	test("should handle binary requirements and notifications", async () => {
		const toolWithBinaries = createTestDescriptor("tool-with-binaries", {
			binaries: [
				{
					binary: 'non-existent-binary',
					label: 'Non-existent Binary',
					installCommand: 'fake install command',
					required: true
				}
			]
		});
		
		// Mock binary as unavailable
		binaryManager.setBinaryOverride('non-existent-binary', false);
		
		registry.register(toolWithBinaries);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		expect(stats.totalTools).toBe(1); // Tool still registers despite missing binary
		expect(stats.missingBinaries.has('non-existent-binary')).toBe(true);
	});
	
	test("should load prompt files correctly", async () => {
		const tool = createTestDescriptor("prompt-test-tool");
		
		registry.register(tool);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		expect(stats.totalTools).toBe(1);
		expect(stats.failures).toHaveLength(0);
	});
	
	test("should handle missing prompt files", async () => {
		const tool = createTestDescriptor("missing-prompt-tool", {
			promptFile: join(tempDir, "non-existent.md")
		});
		
		registry.register(tool);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		expect(stats.totalTools).toBe(0);
		expect(stats.failures).toHaveLength(1);
		expect(stats.failures[0].error).toContain("Failed to load prompt file");
	});
	
	test("should calculate statistics correctly", async () => {
		const searchTool1 = createTestDescriptor("search-1", { 
			category: 'search' as ToolCategory 
		});
		const searchTool2 = createTestDescriptor("search-2", { 
			category: 'search' as ToolCategory 
		});
		const fileOpsTool = createTestDescriptor("file-ops-1", { 
			category: 'file-ops' as ToolCategory 
		});
		
		registry.register(searchTool1);
		registry.register(searchTool2);
		registry.register(fileOpsTool);
		
		const stats = await registry.loadAndRegisterAll(mockApi, mockContext);
		
		expect(stats.totalTools).toBe(3);
		expect(stats.byCategory.get('search' as ToolCategory)).toBe(2);
		expect(stats.byCategory.get('file-ops' as ToolCategory)).toBe(1);
		expect(stats.registrationTime).toBeGreaterThanOrEqual(0);
	});
	
	test("should clear registry", () => {
		const tool = createTestDescriptor("test-tool");
		registry.register(tool);
		
		expect(registry.getAllTools()).toHaveLength(1);
		
		registry.clear();
		
		expect(registry.getAllTools()).toHaveLength(0);
		expect(registry.hasTool("test-tool")).toBe(false);
	});
});