/**
 * Tests for the auto-installer functionality
 */

import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { platform } from "node:os";
import { AutoInstaller, createAutoInstallConfigs, type InstallationResult, type AutoInstallConfig } from "../../src/core/auto-installer";

// Mock the execSync function
const mockExecSync = mock(() => {});
mock.module("node:child_process", () => ({
	execSync: mockExecSync
}));

// Mock extension context
const mockContext = {
	ui: {
		notify: mock(() => {})
	}
};

describe("AutoInstaller", () => {
	let autoInstaller: AutoInstaller;
	
	beforeEach(() => {
		autoInstaller = new AutoInstaller({
			requireUserConsent: false, // Skip consent for testing
			installRequired: true,
			installOptional: false,
			maxRetries: 1,
			installTimeout: 10000,
			verifyInstallation: false // Skip verification for testing
		});
		mockExecSync.mockClear();
		mockContext.ui.notify.mockClear();
	});
	
	test("should find compatible installation method", () => {
		const configs = createAutoInstallConfigs();
		const ripgrepConfig = configs.find(c => c.requirement.binary === 'rg')!;
		
		expect(ripgrepConfig).toBeDefined();
		expect(ripgrepConfig.methods.length).toBeGreaterThan(0);
		
		// Should have method for current platform
		const currentPlatform = platform();
		const hasCompatible = ripgrepConfig.methods.some(method => 
			method.platforms.includes(currentPlatform)
		);
		expect(hasCompatible).toBe(true);
	});
	
	test("should handle installation success", async () => {
		const testConfig: AutoInstallConfig = {
			requirement: {
				binary: 'test-tool',
				label: 'Test Tool',
				installCommand: 'brew install test-tool',
				required: true
			},
			methods: [{
				method: 'brew',
				command: 'brew install test-tool',
				platforms: [platform()],
				verifyCommand: 'test-tool --version'
			}],
			autoInstallEnabled: true
		};
		
		// Mock successful installation
		mockExecSync.mockReturnValue('');
		
		const result = await autoInstaller.installBinary(testConfig, mockContext as any);
		
		expect(result.success).toBe(true);
		expect(result.binary).toBe('test-tool');
		expect(result.userConsented).toBe(true);
		expect(mockContext.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining('Successfully installed'),
			'info'
		);
	});
	
	test("should handle installation failure", async () => {
		const testConfig: AutoInstallConfig = {
			requirement: {
				binary: 'test-tool',
				label: 'Test Tool', 
				installCommand: 'brew install test-tool',
				required: true
			},
			methods: [{
				method: 'brew',
				command: 'brew install test-tool',
				platforms: [platform()],
				verifyCommand: 'test-tool --version'
			}],
			autoInstallEnabled: true
		};
		
		// Mock package manager available but installation failure
		mockExecSync.mockImplementation((cmd: string) => {
			if (cmd.includes('which brew')) {
				return '/usr/local/bin/brew'; // Package manager available
			}
			throw new Error('Installation failed');
		});
		
		const result = await autoInstaller.installBinary(testConfig, mockContext as any);
		
		expect(result.success).toBe(false);
		expect(result.binary).toBe('test-tool');
		expect(result.error).toBe('Installation failed');
		expect(mockContext.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining('Failed to install'),
			'error'
		);
	});
	
	test("should skip disabled auto-install configs", async () => {
		const testConfig: AutoInstallConfig = {
			requirement: {
				binary: 'test-tool',
				label: 'Test Tool',
				installCommand: 'brew install test-tool',
				required: true
			},
			methods: [{
				method: 'brew',
				command: 'brew install test-tool',
				platforms: [platform()]
			}],
			autoInstallEnabled: false
		};
		
		const results = await autoInstaller.autoInstallMissing([testConfig], mockContext as any);
		
		expect(results).toHaveLength(0);
		expect(mockExecSync).not.toHaveBeenCalled();
	});
	
	test("should skip optional tools when installOptional is false", async () => {
		const testConfig: AutoInstallConfig = {
			requirement: {
				binary: 'test-tool',
				label: 'Test Tool',
				installCommand: 'brew install test-tool',
				required: false // Optional tool
			},
			methods: [{
				method: 'brew',
				command: 'brew install test-tool',
				platforms: [platform()]
			}],
			autoInstallEnabled: true
		};
		
		const results = await autoInstaller.autoInstallMissing([testConfig], mockContext as any);
		
		expect(results).toHaveLength(0);
		expect(mockExecSync).not.toHaveBeenCalled();
	});
	
	test("should track installation statistics", async () => {
		const configs: AutoInstallConfig[] = [
			{
				requirement: { binary: 'tool1', label: 'Tool 1', installCommand: 'install tool1', required: true },
				methods: [{ method: 'brew', command: 'brew install tool1', platforms: [platform()] }],
				autoInstallEnabled: true
			},
			{
				requirement: { binary: 'tool2', label: 'Tool 2', installCommand: 'install tool2', required: true },
				methods: [{ method: 'brew', command: 'brew install tool2', platforms: [platform()] }],
				autoInstallEnabled: true
			}
		];
		
		// Mock package manager checks and installations
		mockExecSync.mockImplementation((cmd: string) => {
			if (cmd.includes('which brew')) {
				return '/usr/local/bin/brew';
			}
			if (cmd.includes('brew install tool1')) {
				return ''; // tool1 success
			}
			if (cmd.includes('brew install tool2')) {
				throw new Error('Failed'); // tool2 failure
			}
			return '';
		});
		
		await autoInstaller.autoInstallMissing(configs, mockContext as any);
		
		const stats = autoInstaller.getStats();
		expect(stats.totalAttempted).toBe(2);
		expect(stats.successful).toBe(1);
		expect(stats.failed).toBe(1);
		expect(stats.userDeclined).toBe(0);
	});
	
	test("should handle pre/post install hooks", async () => {
		const preInstallHook = mock(() => Promise.resolve());
		const postInstallHook = mock(() => Promise.resolve());
		
		const testConfig: AutoInstallConfig = {
			requirement: {
				binary: 'test-tool',
				label: 'Test Tool',
				installCommand: 'brew install test-tool',
				required: true
			},
			methods: [{
				method: 'brew',
				command: 'brew install test-tool',
				platforms: [platform()]
			}],
			autoInstallEnabled: true,
			preInstall: preInstallHook,
			postInstall: postInstallHook
		};
		
		mockExecSync.mockReturnValue('');
		
		const result = await autoInstaller.installBinary(testConfig, mockContext as any);
		
		expect(result.success).toBe(true);
		expect(preInstallHook).toHaveBeenCalled();
		expect(postInstallHook).toHaveBeenCalled();
	});
	
	test("should clear installation history", () => {
		const stats = autoInstaller.getStats();
		expect(stats.totalAttempted).toBe(0);
		
		autoInstaller.clearHistory();
		
		const clearedStats = autoInstaller.getStats();
		expect(clearedStats.totalAttempted).toBe(0);
	});
});

describe("createAutoInstallConfigs", () => {
	test("should create configs for all required tools", () => {
		const configs = createAutoInstallConfigs();
		
		// Should have configs for core required tools
		const requiredTools = ['rg', 'fd', 'fzf', 'semgrep'];
		for (const tool of requiredTools) {
			const config = configs.find(c => c.requirement.binary === tool);
			expect(config).toBeDefined();
			expect(config?.requirement.required).toBe(true);
			expect(config?.autoInstallEnabled).toBe(true);
		}
		
		// Should have configs for optional tools
		const optionalTools = ['ast-grep', 'tokei', 'jq', 'yq', 'bat', 'nu', 'br'];
		for (const tool of optionalTools) {
			const config = configs.find(c => c.requirement.binary === tool);
			expect(config).toBeDefined();
			expect(config?.requirement.required).toBe(false);
		}
	});
	
	test("should have platform-specific installation methods", () => {
		const configs = createAutoInstallConfigs();
		
		for (const config of configs) {
			expect(config.methods.length).toBeGreaterThan(0);
			
			// Each method should specify supported platforms
			for (const method of config.methods) {
				expect(method.platforms.length).toBeGreaterThan(0);
				// Command should be a valid installation command
				expect(method.command.length).toBeGreaterThan(0);
				expect(method.command).toContain('install');
			}
		}
	});
	
	test("should have verification commands for methods", () => {
		const configs = createAutoInstallConfigs();
		
		for (const config of configs) {
			for (const method of config.methods) {
				// Most methods should have verification commands
				if (method.verifyCommand) {
					expect(method.verifyCommand).toContain(config.requirement.binary);
				}
			}
		}
	});
});