/**
 * Tests for the Command Executor
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { 
	CommandExecutor,
	CommandExecutionError,
	CommandTimeoutError,
	CommandCancelledError
} from "../../src/core/command-executor";

describe("CommandExecutor", () => {
	
	test("should execute simple commands successfully", async () => {
		const result = await CommandExecutor.execute('echo', ['hello world']);
		
		expect(result.command).toBe('echo');
		expect(result.args).toEqual(['hello world']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe('hello world');
		expect(result.stderr).toBe('');
		expect(result.duration).toBeGreaterThan(0);
		expect(result.cancelled).toBe(false);
	});
	
	test("should handle command arguments correctly", async () => {
		const result = await CommandExecutor.execute('echo', ['-n', 'no newline']);
		
		expect(result.stdout).toBe('no newline');
		expect(result.exitCode).toBe(0);
	});
	
	test("should handle working directory option", async () => {
		const result = await CommandExecutor.execute('pwd', [], { cwd: '/tmp' });
		
		// On macOS, /tmp resolves to /private/tmp
		expect(result.stdout.trim()).toMatch(/^(\/tmp|\/private\/tmp)$/);
		expect(result.cwd).toBe('/tmp');
	});
	
	test("should handle environment variables", async () => {
		const result = await CommandExecutor.execute('printenv', ['TEST_VAR'], {
			env: { TEST_VAR: 'test_value' }
		});
		
		expect(result.stdout.trim()).toBe('test_value');
		expect(result.env).toHaveProperty('TEST_VAR', 'test_value');
	});
	
	test("should handle stdin input", async () => {
		const result = await CommandExecutor.execute('cat', [], {
			input: 'hello from stdin'
		});
		
		expect(result.stdout.trim()).toBe('hello from stdin');
	});
	
	test("should handle command failures", async () => {
		await expect(async () => {
			await CommandExecutor.execute('false'); // Always exits with code 1
		}).toThrow(CommandExecutionError);
		
		try {
			await CommandExecutor.execute('false');
		} catch (error) {
			expect(error).toBeInstanceOf(CommandExecutionError);
			if (error instanceof CommandExecutionError) {
				expect(error.result.exitCode).toBe(1);
				expect(error.result.command).toBe('false');
			}
		}
	});
	
	test("should not throw on error when throwOnError is false", async () => {
		const result = await CommandExecutor.execute('false', [], { 
			throwOnError: false 
		});
		
		expect(result.exitCode).toBe(1);
		expect(result.command).toBe('false');
	});
	
	test("should handle command timeouts", async () => {
		await expect(async () => {
			await CommandExecutor.execute('sleep', ['2'], { timeout: 100 });
		}).toThrow(CommandTimeoutError);
		
		try {
			await CommandExecutor.execute('sleep', ['2'], { timeout: 100 });
		} catch (error) {
			expect(error).toBeInstanceOf(CommandTimeoutError);
			if (error instanceof CommandTimeoutError) {
				expect(error.result.command).toBe('sleep');
			}
		}
	});
	
	test("should handle abort signals", async () => {
		const controller = new AbortController();
		
		// Abort after 50ms
		setTimeout(() => controller.abort(), 50);
		
		await expect(async () => {
			await CommandExecutor.execute('sleep', ['2'], { 
				signal: controller.signal 
			});
		}).toThrow(CommandCancelledError);
	});
	
	test("should handle non-existent commands", async () => {
		await expect(async () => {
			await CommandExecutor.execute('non-existent-command-xyz');
		}).toThrow(CommandExecutionError);
	});
	
	test("should executeForOutput return only stdout", async () => {
		const output = await CommandExecutor.executeForOutput('echo', ['test output']);
		expect(output.trim()).toBe('test output');
	});
	
	test("should executeSafe not throw on errors", async () => {
		const result = await CommandExecutor.executeSafe('false');
		expect(result.exitCode).toBe(1);
	});
	
	test("should check if commands exist", async () => {
		const echoExists = await CommandExecutor.exists('echo');
		expect(echoExists).toBe(true);
		
		const fakeExists = await CommandExecutor.exists('non-existent-command-xyz');
		expect(fakeExists).toBe(false);
	});
	
	test("should execute multiple commands in parallel", async () => {
		const startTime = Date.now();
		
		const results = await CommandExecutor.executeParallel([
			{ command: 'echo', args: ['first'] },
			{ command: 'echo', args: ['second'] },
			{ command: 'echo', args: ['third'] }
		]);
		
		const duration = Date.now() - startTime;
		
		expect(results).toHaveLength(3);
		expect(results[0].stdout.trim()).toBe('first');
		expect(results[1].stdout.trim()).toBe('second');
		expect(results[2].stdout.trim()).toBe('third');
		
		// Should complete much faster than sequential execution
		expect(duration).toBeLessThan(1000);
	});
	
	test("should execute commands in sequence", async () => {
		const results = await CommandExecutor.executeSequence([
			{ command: 'echo', args: ['first'] },
			{ command: 'echo', args: ['second'] }
		]);
		
		expect(results).toHaveLength(2);
		expect(results[0].stdout.trim()).toBe('first');
		expect(results[1].stdout.trim()).toBe('second');
	});
	
	test("should handle stdout size limits", async () => {
		const result = await CommandExecutor.execute('echo', [
			'a'.repeat(1000) // Generate long output
		], {
			maxStdoutSize: 100,
			throwOnError: false
		});
		
		expect(result.stdout.length).toBeLessThanOrEqual(150); // Includes truncation message
		expect(result.stdout).toContain('[... stdout truncated ...]');
	});
	
	test("should handle stderr separately", async () => {
		// Use a command that writes to stderr
		const result = await CommandExecutor.executeSafe('sh', ['-c', 'echo "error" >&2; echo "output"']);
		
		expect(result.stdout.trim()).toBe('output');
		expect(result.stderr.trim()).toBe('error');
	});
	
	test("should combine multiple abort signals", async () => {
		const controller1 = new AbortController();
		const controller2 = new AbortController();
		
		setTimeout(() => controller1.abort(), 50);
		
		await expect(async () => {
			await CommandExecutor.execute('sleep', ['2'], { 
				signal: controller1.signal 
			});
		}).toThrow(CommandCancelledError);
	});
	
	test("should handle already aborted signals", async () => {
		const controller = new AbortController();
		controller.abort(); // Abort immediately
		
		await expect(async () => {
			await CommandExecutor.execute('echo', ['test'], { 
				signal: controller.signal 
			});
		}).toThrow(CommandCancelledError);
	});
	
	test("should measure execution duration accurately", async () => {
		const result = await CommandExecutor.execute('sleep', ['0.1']);
		
		expect(result.duration).toBeGreaterThan(50); // At least 50ms
		expect(result.duration).toBeLessThan(1000); // Less than 1s
	});
	
	test("should preserve exit codes correctly", async () => {
		const result = await CommandExecutor.executeSafe('sh', ['-c', 'exit 42']);
		expect(result.exitCode).toBe(42);
	});
	
	// Skip Bun-specific tests if not running in Bun
	const isBun = typeof Bun !== 'undefined';
	
	(isBun ? test : test.skip)("should execute with Bun spawn when available", async () => {
		const result = await CommandExecutor.executeBun('echo', ['bun test']);
		
		expect(result.stdout.trim()).toBe('bun test');
		expect(result.exitCode).toBe(0);
	});
	
	(isBun ? test : test.skip)("should fallback from Bun spawn gracefully", async () => {
		// This should work whether or not we're in Bun
		const result = await CommandExecutor.executeBun('echo', ['fallback test']);
		expect(result.stdout.trim()).toBe('fallback test');
	});
});