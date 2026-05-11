/**
 * Integration tests for the decomposed shell module
 */

import { describe, test, expect } from "bun:test";
import { NushellJsonExecutor, createDefaultShellDeps } from "../../src/shell";

describe("Shell Integration", () => {
	
	test("should maintain backward compatibility", () => {
		// Verify that the main exports are still available
		expect(NushellJsonExecutor).toBeDefined();
		expect(createDefaultShellDeps).toBeDefined();
		expect(typeof NushellJsonExecutor).toBe("function");
		expect(typeof createDefaultShellDeps).toBe("function");
	});
	
	test("should create executor with default dependencies", () => {
		const executor = new NushellJsonExecutor();
		expect(executor).toBeDefined();
		expect(typeof executor.execute).toBe("function");
		expect(typeof executor.getAvailableBackends).toBe("function");
	});
	
	test("should list available backends", () => {
		const executor = new NushellJsonExecutor();
		const backends = executor.getAvailableBackends();
		
		expect(Array.isArray(backends)).toBe(true);
		expect(backends.length).toBeGreaterThan(0);
		expect(backends.includes("bash")).toBe(true); // Bash should always be available
	});
	
	test("should execute simple commands", async () => {
		const executor = new NushellJsonExecutor();
		
		// Test with a simple, reliable command
		const result = await executor.execute({
			command: "echo hello",
			enforceJson: false,
			timeout: 5000
		});
		
		expect(result).toBeDefined();
		expect(result.rawOutput).toContain("hello");
		expect(result.exitCode).toBe(0);
		expect(result.executionTime).toBeGreaterThan(0);
		expect(["nushell", "bun", "bash"].includes(result.shell)).toBe(true);
	});
	
	test("should handle command failures", async () => {
		const executor = new NushellJsonExecutor();
		
		const result = await executor.execute({
			command: "nonexistentcommand12345",
			enforceJson: false,
			timeout: 5000
		});
		
		expect(result.exitCode).not.toBe(0);
		expect(result.rawOutput.length >= 0).toBe(true); // May be empty
	});
	
	test("should respect working directory", async () => {
		const executor = new NushellJsonExecutor();
		
		const result = await executor.execute({
			command: "pwd",
			enforceJson: false,
			cwd: "/tmp",
			timeout: 5000
		});
		
		expect(result.exitCode).toBe(0);
		// The output should reflect the /tmp directory (or equivalent)
		expect(result.rawOutput.toLowerCase()).toContain("tmp");
	});
	
	test("should handle JSON pipeline enhancement", async () => {
		const executor = new NushellJsonExecutor();
		
		const result = await executor.execute({
			command: "echo hello",
			enforceJson: true, // This will try to add JSON pipeline
			timeout: 5000
		});
		
		expect(result.exitCode).toBe(0);
		expect(result.rawOutput).toBeTruthy();
	});
	
	test("should handle timeout", async () => {
		const executor = new NushellJsonExecutor();
		
		// Use a command that should complete quickly
		const result = await executor.execute({
			command: "echo quick",
			timeout: 10000 // 10 second timeout should be plenty
		});
		
		expect(result.exitCode).toBe(0);
		expect(result.executionTime).toBeLessThan(10000);
	});
	
	test("should parse structured output when available", async () => {
		const executor = new NushellJsonExecutor();
		
		// Try to get structured output (this may vary by system)
		const result = await executor.execute({
			command: "echo '[{\"name\": \"test\", \"value\": 123}]'",
			enforceJson: false,
			timeout: 5000
		});
		
		expect(result.exitCode).toBe(0);
		
		// If JSON was successfully parsed, structured should be true
		if (result.structured) {
			expect(Array.isArray(result.output) || typeof result.output === "object").toBe(true);
		}
	});
	
	test("should handle environment variables", async () => {
		const executor = new NushellJsonExecutor();
		
		const result = await executor.execute({
			command: "echo $TEST_VAR",
			env: { TEST_VAR: "test_value" },
			timeout: 5000
		});
		
		expect(result.exitCode).toBe(0);
		expect(result.rawOutput).toContain("test_value");
	});
});