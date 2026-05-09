/**
 * Tests for the Binary Manager
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { BinaryManager } from "../../src/core/binary-manager";
import type { BinaryRequirement } from "../../src/core/tool-descriptor";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

describe("BinaryManager", () => {
	let binaryManager: BinaryManager;
	let mockContext: ExtensionContext;
	
	beforeEach(() => {
		binaryManager = new BinaryManager({
			showNotifications: true,
			notificationType: 'warning'
		});
		
		// Mock ExtensionContext
		const notifications: Array<{message: string, type: string}> = [];
		mockContext = {
			ui: {
				notify: (message: string, type: string = 'info') => {
					notifications.push({ message, type });
				}
			}
		} as any;
		
		// Expose notifications for test access
		(mockContext as any)._notifications = notifications;
	});
	
	const createTestRequirement = (
		binary: string,
		required = true,
		customCheck?: () => boolean
	): BinaryRequirement => ({
		binary,
		label: `Test ${binary}`,
		installCommand: `install ${binary}`,
		required,
		customCheck
	});
	
	test("should check binary availability", () => {
		// Test with a binary that should exist (assuming 'echo' exists on all systems)
		const echoRequirement = createTestRequirement('echo');
		const result = binaryManager.isAvailable(echoRequirement);
		
		expect(result.binary).toBe('echo');
		expect(result.available).toBe(true);
		expect(result.error).toBeUndefined();
	});
	
	test("should handle missing binaries", () => {
		const missingRequirement = createTestRequirement('non-existent-binary-xyz');
		const result = binaryManager.isAvailable(missingRequirement);
		
		expect(result.binary).toBe('non-existent-binary-xyz');
		expect(result.available).toBe(false);
		expect(result.error).toBeUndefined();
	});
	
	test("should use custom check function", () => {
		const customRequirement = createTestRequirement(
			'custom-binary',
			true,
			() => true // Always return true
		);
		
		const result = binaryManager.isAvailable(customRequirement);
		
		expect(result.available).toBe(true);
	});
	
	test("should cache binary check results", () => {
		const requirement = createTestRequirement('test-binary');
		
		// First call - should cache the result (likely false for non-existent binary)
		const result1 = binaryManager.isAvailable(requirement);
		const initialResult = result1.available;
		
		// Set override to opposite value
		binaryManager.setBinaryOverride('test-binary', !initialResult);
		const result2 = binaryManager.isAvailable(requirement);
		expect(result2.available).toBe(!initialResult); // Uses override
		
		// Clear override - should now use actual binary check, not cache
		binaryManager.clearOverrides();
		const result3 = binaryManager.isAvailable(requirement);
		
		// Since cache was bypassed by override, this should check again and cache
		expect(result3.available).toBe(initialResult);
	});
	
	test("should use overrides for testing", () => {
		const requirement = createTestRequirement('override-test');
		
		// Override as available
		binaryManager.setBinaryOverride('override-test', true);
		let result = binaryManager.isAvailable(requirement);
		expect(result.available).toBe(true);
		
		// Override as unavailable  
		binaryManager.setBinaryOverride('override-test', false);
		result = binaryManager.isAvailable(requirement);
		expect(result.available).toBe(false);
	});
	
	test("should check multiple requirements", () => {
		const req1 = createTestRequirement('binary-1');
		const req2 = createTestRequirement('binary-2');
		
		binaryManager.setBinaryOverride('binary-1', true);
		binaryManager.setBinaryOverride('binary-2', false);
		
		const results = binaryManager.checkRequirements([req1, req2]);
		
		expect(results).toHaveLength(2);
		expect(results[0].available).toBe(true);
		expect(results[1].available).toBe(false);
	});
	
	test("should get missing requirements", () => {
		const req1 = createTestRequirement('available-binary');
		const req2 = createTestRequirement('missing-binary');
		
		binaryManager.setBinaryOverride('available-binary', true);
		binaryManager.setBinaryOverride('missing-binary', false);
		
		const missing = binaryManager.getMissingRequirements([req1, req2]);
		
		expect(missing).toHaveLength(1);
		expect(missing[0].binary).toBe('missing-binary');
	});
	
	test("should send notifications for missing binaries", () => {
		const missingReq = createTestRequirement('missing-for-notification');
		
		binaryManager.notifyMissing([missingReq], mockContext);
		
		const notifications = (mockContext as any)._notifications;
		expect(notifications).toHaveLength(1);
		expect(notifications[0].message).toContain('missing-for-notification');
		expect(notifications[0].message).toContain('required');
		expect(notifications[0].type).toBe('warning');
	});
	
	test("should format notification messages correctly", () => {
		const requirement: BinaryRequirement = {
			binary: 'test-binary',
			label: 'Test Binary',
			installCommand: 'brew install test-binary',
			required: true
		};
		
		binaryManager.notifyMissing([requirement], mockContext);
		
		const notifications = (mockContext as any)._notifications;
		expect(notifications[0].message).toBe(
			'pi-sherlock: Test Binary (required) is not available. Install with: brew install test-binary'
		);
	});
	
	test("should handle optional vs required binaries in messages", () => {
		const required = createTestRequirement('required-binary', true);
		const optional = createTestRequirement('optional-binary', false);
		
		binaryManager.notifyMissing([required, optional], mockContext);
		
		const notifications = (mockContext as any)._notifications;
		expect(notifications).toHaveLength(2);
		expect(notifications[0].message).toContain('(required)');
		expect(notifications[1].message).toContain('(optional)');
	});
	
	test("should skip notifications when disabled", () => {
		const noNotifyManager = new BinaryManager({
			showNotifications: false
		});
		
		const requirement = createTestRequirement('missing-binary');
		noNotifyManager.notifyMissing([requirement], mockContext);
		
		const notifications = (mockContext as any)._notifications;
		expect(notifications).toHaveLength(0);
	});
	
	test("should calculate statistics", () => {
		const req1 = createTestRequirement('binary-1', true);   // required, available
		const req2 = createTestRequirement('binary-2', false);  // optional, available
		const req3 = createTestRequirement('binary-3', true);   // required, missing
		const req4 = createTestRequirement('binary-4', false);  // optional, missing
		
		binaryManager.setBinaryOverride('binary-1', true);
		binaryManager.setBinaryOverride('binary-2', true);
		binaryManager.setBinaryOverride('binary-3', false);
		binaryManager.setBinaryOverride('binary-4', false);
		
		const stats = binaryManager.getStats([req1, req2, req3, req4]);
		
		expect(stats.total).toBe(4);
		expect(stats.available).toBe(2);
		expect(stats.missing).toBe(2);
		expect(stats.required).toBe(2);
		expect(stats.optional).toBe(2);
	});
	
	test("should clear overrides", () => {
		binaryManager.setBinaryOverride('test-binary', true);
		
		const req = createTestRequirement('test-binary');
		expect(binaryManager.isAvailable(req).available).toBe(true);
		
		binaryManager.clearOverrides();
		
		// Should now use actual binary check (likely false for non-existent binary)
		const result = binaryManager.isAvailable(req);
		expect(result.available).toBe(false);
	});
	
	test("should handle custom message templates", () => {
		const customManager = new BinaryManager({
			showNotifications: true,
			notificationType: 'error',
			messageTemplate: 'Missing {binary} ({label}): {install}'
		});
		
		const requirement = createTestRequirement('custom-binary');
		customManager.notifyMissing([requirement], mockContext);
		
		const notifications = (mockContext as any)._notifications;
		expect(notifications[0].message).toBe(
			'Missing custom-binary (Test custom-binary): install custom-binary'
		);
		expect(notifications[0].type).toBe('error');
	});
});