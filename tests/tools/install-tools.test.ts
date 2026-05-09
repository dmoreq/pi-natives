/**
 * Tests for the install-tools command
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { registerInstallToolsTool } from "../../src/tools/install-tools";

// Mock the binary manager and auto-installer
const mockBinaryManager = {
	getMissingRequirements: mock(() => []),
	notifyMissing: mock(() => Promise.resolve()),
	installBinaries: mock(() => Promise.resolve([])),
	setBinaryOverride: mock(() => {}),
	getStats: mock(() => ({
		totalTools: 10,
		available: 8,
		missing: 2,
		required: 4,
		optional: 6,
		installations: {
			attempted: 2,
			successful: 1,
			failed: 1,
			userDeclined: 0
		}
	}))
};

mock.module("../../src/core/binary-manager", () => ({
	BinaryManager: mock().mockImplementation(() => mockBinaryManager),
	createBinaryRequirements: mock(() => ({
		ripgrep: { binary: 'rg', label: 'ripgrep', installCommand: 'brew install ripgrep', required: true },
		fd: { binary: 'fd', label: 'fd', installCommand: 'brew install fd', required: true }
	}))
}));

// Mock extension API
const mockApi = {
	registerTool: mock(() => {})
};

// Mock extension context
const mockContext = {
	ui: {
		notify: mock(() => {})
	}
};

describe("install-tools tool", () => {
	beforeEach(() => {
		mockApi.registerTool.mockClear();
		mockContext.ui.notify.mockClear();
		mockBinaryManager.getMissingRequirements.mockClear();
		mockBinaryManager.notifyMissing.mockClear();
		mockBinaryManager.installBinaries.mockClear();
		mockBinaryManager.setBinaryOverride.mockClear();
		mockBinaryManager.getStats.mockClear();
	});
	
	test("should register install-tools command correctly", () => {
		const description = "Install missing pi-sherlock tools";
		
		registerInstallToolsTool(mockApi as any, description);
		
		expect(mockApi.registerTool).toHaveBeenCalledWith(
			"install_tools",
			description,
			expect.objectContaining({
				binaries: expect.objectContaining({
					type: "array",
					items: { type: "string" }
				}),
				required_only: expect.objectContaining({
					type: "boolean",
					default: false
				}),
				force: expect.objectContaining({
					type: "boolean", 
					default: false
				})
			}),
			expect.any(Function)
		);
	});
	
	test("should install all missing required tools by default", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		// Mock missing tools
		mockBinaryManager.getMissingRequirements.mockReturnValue([
			{ binary: 'rg', label: 'ripgrep', installCommand: 'brew install ripgrep', required: true },
			{ binary: 'fd', label: 'fd', installCommand: 'brew install fd', required: true }
		]);
		
		// Mock successful installation
		mockBinaryManager.installBinaries.mockResolvedValue([
			{ binary: 'rg', success: true, userConsented: true, installTime: 5000 },
			{ binary: 'fd', success: true, userConsented: true, installTime: 3000 }
		]);
		
		const result = await toolFunction({}, mockContext);
		
		expect(mockBinaryManager.installBinaries).toHaveBeenCalledWith(['rg', 'fd'], mockContext);
		expect(result.success).toBe(true);
		expect(result.installed).toEqual(['rg', 'fd']);
		expect(result.failed).toHaveLength(0);
		expect(mockContext.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining('Starting installation'),
			'info'
		);
	});
	
	test("should install specific binaries when provided", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		mockBinaryManager.installBinaries.mockResolvedValue([
			{ binary: 'semgrep', success: true, userConsented: true, installTime: 10000 }
		]);
		
		const result = await toolFunction(
			{ binaries: ['semgrep'] },
			mockContext
		);
		
		expect(mockBinaryManager.installBinaries).toHaveBeenCalledWith(['semgrep'], mockContext);
		expect(result.installed).toEqual(['semgrep']);
	});
	
	test("should handle required_only parameter", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		// Mock missing tools (both required and optional)
		mockBinaryManager.getMissingRequirements.mockReturnValue([
			{ binary: 'rg', label: 'ripgrep', installCommand: 'brew install ripgrep', required: true },
			{ binary: 'ast-grep', label: 'ast-grep', installCommand: 'npm install -g @ast-grep/cli', required: false }
		]);
		
		mockBinaryManager.installBinaries.mockResolvedValue([
			{ binary: 'rg', success: true, userConsented: true, installTime: 5000 }
		]);
		
		const result = await toolFunction(
			{ required_only: true },
			mockContext
		);
		
		// Should only install required tools
		expect(mockBinaryManager.installBinaries).toHaveBeenCalledWith(['rg'], mockContext);
		expect(result.installed).toEqual(['rg']);
	});
	
	test("should handle force reinstall", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		mockBinaryManager.getMissingRequirements.mockReturnValue([]);
		mockBinaryManager.installBinaries.mockResolvedValue([
			{ binary: 'rg', success: true, userConsented: true, installTime: 5000 }
		]);
		
		const result = await toolFunction(
			{ binaries: ['rg'], force: true },
			mockContext
		);
		
		// Should set binary override to force reinstall
		expect(mockBinaryManager.setBinaryOverride).toHaveBeenCalledWith('rg', false);
		expect(mockBinaryManager.installBinaries).toHaveBeenCalledWith(['rg'], mockContext);
	});
	
	test("should return success when all tools already installed", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		mockBinaryManager.getMissingRequirements.mockReturnValue([]);
		
		const result = await toolFunction({}, mockContext);
		
		expect(result.success).toBe(true);
		expect(result.message).toContain("All tools are already installed!");
		expect(result.installed).toHaveLength(0);
		expect(mockBinaryManager.installBinaries).not.toHaveBeenCalled();
	});
	
	test("should handle installation failures", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		mockBinaryManager.getMissingRequirements.mockReturnValue([
			{ binary: 'rg', label: 'ripgrep', installCommand: 'brew install ripgrep', required: true }
		]);
		
		// Mock installation failure
		mockBinaryManager.installBinaries.mockResolvedValue([
			{ binary: 'rg', success: false, userConsented: true, error: 'Package not found', installTime: 2000 }
		]);
		
		const result = await toolFunction({}, mockContext);
		
		expect(result.success).toBe(false);
		expect(result.failed).toHaveLength(1);
		expect(result.failed[0]).toEqual({
			binary: 'rg',
			error: 'Package not found'
		});
		expect(result.message).toContain("❌ Failed (1)");
	});
	
	test("should handle user declined installations", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		mockBinaryManager.getMissingRequirements.mockReturnValue([
			{ binary: 'rg', label: 'ripgrep', installCommand: 'brew install ripgrep', required: true }
		]);
		
		// Mock user declined
		mockBinaryManager.installBinaries.mockResolvedValue([
			{ binary: 'rg', success: false, userConsented: false, installTime: 100 }
		]);
		
		const result = await toolFunction({}, mockContext);
		
		expect(result.skipped).toEqual(['rg']);
		expect(result.message).toContain("⏭️ Skipped (1)");
	});
	
	test("should provide comprehensive installation statistics", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		mockBinaryManager.getMissingRequirements.mockReturnValue([
			{ binary: 'rg', label: 'ripgrep', installCommand: 'brew install ripgrep', required: true }
		]);
		
		mockBinaryManager.installBinaries.mockResolvedValue([
			{ binary: 'rg', success: true, userConsented: true, installTime: 5000 }
		]);
		
		const result = await toolFunction({}, mockContext);
		
		expect(result.stats).toBeDefined();
		expect(result.stats.totalAttempted).toBe(1);
		expect(result.stats.successful).toBe(1);
		expect(result.stats.failed).toBe(0);
		expect(result.stats.totalTime).toBe(5); // Converted to seconds
	});
	
	test("should handle installation errors gracefully", async () => {
		registerInstallToolsTool(mockApi as any, "test");
		const toolFunction = mockApi.registerTool.mock.calls[0][3];
		
		// Mock an error during installation
		mockBinaryManager.installBinaries.mockRejectedValue(new Error("Network error"));
		
		const result = await toolFunction(
			{ binaries: ['rg'] },
			mockContext
		);
		
		expect(result.success).toBe(false);
		expect(result.error).toBe("Network error");
		expect(mockContext.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining('Installation failed: Network error'),
			'error'
		);
	});
});