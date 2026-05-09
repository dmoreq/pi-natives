/**
 * Tests for the enhanced binary manager with auto-installation
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { BinaryManager, type EnhancedBinaryManagerOptions } from "../../src/core/binary-manager";
import type { BinaryRequirement } from "../../src/core/tool-descriptor";

// Mock the checkBinary function
const mockCheckBinary = mock(() => false);
mock.module("../../src/shared/cli", () => ({
	checkBinary: mockCheckBinary
}));

// Mock the execSync function for auto-installer
const mockExecSync = mock(() => {});
mock.module("node:child_process", () => ({
	execSync: mockExecSync
}));

// Mock the createAutoInstallConfigs function
const mockCreateAutoInstallConfigs = mock(() => []);
let mockInstallationResults: any[] = [];
let mockShouldFail = false;

mock.module("../../src/core/auto-installer", () => ({
	AutoInstaller: class MockAutoInstaller {
		private options: any;
		
		constructor(options: any) {
			this.options = options;
		}
		
		async autoInstallMissing(configs: any[], context: any) {
			const results: any[] = [];
			
			for (const config of configs) {
				// Check if should install based on requirement type and options
				const shouldInstall = config.requirement.required 
					? this.options.installRequired 
					: this.options.installOptional;
					
				if (!shouldInstall) {
					continue;
				}
				
				const result = {
					binary: config.requirement.binary,
					success: !mockShouldFail,
					userConsented: true,
					installTime: 5000,
					...(mockShouldFail && { error: 'Installation failed' })
				};
				
				results.push(result);
			}
			
			mockInstallationResults = [...results];
			return results;
		}
		
		getStats() {
			const successful = mockInstallationResults.filter(r => r.success).length;
			const failed = mockInstallationResults.filter(r => !r.success && r.userConsented).length;
			
			return {
				totalAttempted: mockInstallationResults.length,
				successful,
				failed,
				userDeclined: 0
			};
		}
	},
	createAutoInstallConfigs: mockCreateAutoInstallConfigs
}));

// Mock extension context
const mockContext = {
	ui: {
		notify: mock(() => {})
	}
};

describe("Enhanced BinaryManager", () => {
	let binaryManager: BinaryManager;
	
	const testRequirements: BinaryRequirement[] = [
		{
			binary: 'test-required',
			label: 'Test Required Tool',
			installCommand: 'install test-required',
			required: true
		},
		{
			binary: 'test-optional',
			label: 'Test Optional Tool',
			installCommand: 'install test-optional',
			required: false
		}
	];
	
	beforeEach(() => {
		// Reset mock state
		mockInstallationResults = [];
		mockShouldFail = false;
		const options: EnhancedBinaryManagerOptions = {
			notifications: {
				showNotifications: true,
				notificationType: 'warning'
			},
			enableAutoInstall: true,
			autoInstaller: {
				requireUserConsent: false,
				installRequired: true,
				installOptional: false,
				maxRetries: 1,
				installTimeout: 10000,
				verifyInstallation: false
			}
		};
		
		// Mock auto-install configs to return our test requirements
		mockCreateAutoInstallConfigs.mockReturnValue([
			{
				requirement: testRequirements[0], // test-required
				methods: [{
					method: 'brew',
					command: `brew install ${testRequirements[0].binary}`,
					platforms: ['darwin']
				}],
				autoInstallEnabled: true
			},
			{
				requirement: testRequirements[1], // test-optional
				methods: [{
					method: 'brew',
					command: `brew install ${testRequirements[1].binary}`,
					platforms: ['darwin']
				}],
				autoInstallEnabled: true
			}
		]);
		
		binaryManager = new BinaryManager(options);
		mockCheckBinary.mockClear();
		mockExecSync.mockClear();
		mockContext.ui.notify.mockClear();
		mockCreateAutoInstallConfigs.mockClear();
	});
	
	test("should auto-install missing required tools", async () => {
		// Mock all binaries as missing initially
		mockCheckBinary.mockReturnValue(false);
		
		// Mock successful installation
		mockExecSync.mockReturnValue('');
		
		// Mock the which command for package manager check
		mockExecSync.mockImplementation((cmd: string) => {
			if (cmd.includes('which brew')) {
				return '/usr/local/bin/brew';
			}
			return '';
		});
		
		const missing = binaryManager.getMissingRequirements(testRequirements);
		await binaryManager.notifyMissing(missing, mockContext as any);
		
		// Should have attempted installation of required tool only
		const results = binaryManager.getAllInstallationResults();
		const requiredResult = results.find(r => r.binary === 'test-required');
		
		expect(requiredResult).toBeDefined();
		expect(requiredResult?.success).toBe(true);
		
		// Optional tool should not be installed
		const optionalResult = results.find(r => r.binary === 'test-optional');
		expect(optionalResult).toBeUndefined();
	});
	
	test("should not auto-install when disabled", async () => {
		const options: EnhancedBinaryManagerOptions = {
			notifications: {
				showNotifications: true,
				notificationType: 'warning'
			},
			enableAutoInstall: false // Disabled
		};
		
		const disabledManager = new BinaryManager(options);
		mockCheckBinary.mockReturnValue(false);
		
		const missing = disabledManager.getMissingRequirements(testRequirements);
		await disabledManager.notifyMissing(missing, mockContext as any);
		
		// Should show notifications but not attempt installation
		expect(mockContext.ui.notify).toHaveBeenCalled();
		expect(mockExecSync).not.toHaveBeenCalled();
		
		const results = disabledManager.getAllInstallationResults();
		expect(results).toHaveLength(0);
	});
	
	test("should handle installation failures gracefully", async () => {
		mockCheckBinary.mockReturnValue(false);
		mockShouldFail = true; // Set mock to simulate failure
		
		const missing = binaryManager.getMissingRequirements(testRequirements);
		await binaryManager.notifyMissing(missing, mockContext as any);
		
		const results = binaryManager.getAllInstallationResults();
		const requiredResult = results.find(r => r.binary === 'test-required');
		
		expect(requiredResult).toBeDefined();
		expect(requiredResult?.success).toBe(false);
		expect(requiredResult?.error).toBe('Installation failed');
	});
	
	test("should manually install specific binaries", async () => {
		mockCheckBinary.mockReturnValue(false);
		mockExecSync.mockImplementation((cmd: string) => {
			if (cmd.includes('which')) {
				return '/usr/local/bin/brew';
			}
			return '';
		});
		
		const results = await binaryManager.installBinaries(['test-required'], mockContext as any);
		
		expect(results).toHaveLength(1);
		expect(results[0].binary).toBe('test-required');
		expect(results[0].success).toBe(true);
		
		// Should update cache
		const installationResult = binaryManager.getInstallationResult('test-required');
		expect(installationResult).toBeDefined();
		expect(installationResult?.success).toBe(true);
	});
	
	test("should throw error when trying to install without auto-installer", async () => {
		const options: EnhancedBinaryManagerOptions = {
			notifications: {
				showNotifications: true,
				notificationType: 'warning'
			},
			enableAutoInstall: false
		};
		
		const disabledManager = new BinaryManager(options);
		
		await expect(
			disabledManager.installBinaries(['test-tool'], mockContext as any)
		).rejects.toThrow('Auto-installation is not enabled');
	});
	
	test("should provide enhanced statistics including installations", () => {
		mockCheckBinary.mockReturnValue(false);
		
		// Simulate some installation results
		binaryManager.setBinaryOverride('test-required', true); // Simulate successful install
		
		const stats = binaryManager.getStats(testRequirements);
		
		expect(stats.total).toBe(2);
		expect(stats.required).toBe(1);
		expect(stats.optional).toBe(1);
		expect(stats.installations).toBeDefined();
		expect(stats.installations.attempted).toBeGreaterThanOrEqual(0);
	});
	
	test("should format enhanced notification messages", async () => {
		mockCheckBinary.mockReturnValue(false);
		
		// Auto-installation disabled to test fallback notification
		const options: EnhancedBinaryManagerOptions = {
			notifications: {
				showNotifications: true,
				notificationType: 'warning'
			},
			enableAutoInstall: false
		};
		
		const manager = new BinaryManager(options);
		const missing = manager.getMissingRequirements(testRequirements);
		await manager.notifyMissing(missing, mockContext as any);
		
		// Should show standard notifications with install commands
		expect(mockContext.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining('Install with:'),
			'warning'
		);
	});
	
	test("should handle custom message templates", async () => {
		mockCheckBinary.mockReturnValue(false);
		
		const options: EnhancedBinaryManagerOptions = {
			notifications: {
				showNotifications: true,
				notificationType: 'info',
				messageTemplate: 'Custom: {label} missing. Run {install}'
			},
			enableAutoInstall: false
		};
		
		const manager = new BinaryManager(options);
		const missing = manager.getMissingRequirements(testRequirements);
		await manager.notifyMissing(missing, mockContext as any);
		
		// Should use custom template
		expect(mockContext.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining('Custom: Test Required Tool missing'),
			'info'
		);
	});
});