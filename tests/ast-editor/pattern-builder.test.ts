/**
 * Tests for AST editor pattern builder
 */

import { describe, test, expect } from "bun:test";
import { 
	buildRewritePattern, 
	strictnessForNodeType, 
	scopeReservationWarnings,
	attachWarnings
} from "../../src/ast-editor/pattern-builder";

describe("Pattern Builder", () => {
	
	test("should build rewrite pattern from user input", () => {
		const pattern = buildRewritePattern("console.log($msg)", "generic");
		expect(pattern).toBe("console.log($msg)");
	});
	
	test("should trim whitespace from patterns", () => {
		const pattern = buildRewritePattern("  console.log($msg)  ");
		expect(pattern).toBe("console.log($msg)");
	});
	
	test("should throw for empty patterns", () => {
		expect(() => buildRewritePattern("")).toThrow("Pattern cannot be blank");
		expect(() => buildRewritePattern("   ")).toThrow("Pattern cannot be blank");
	});
	
	test("should handle node type hints", () => {
		const pattern = buildRewritePattern("myFunction", "function");
		expect(pattern).toBe("myFunction");
	});
	
	test("should determine strictness for node types", () => {
		expect(strictnessForNodeType("function")).toEqual({
			strict: true,
			preFilter: "function"
		});
		
		expect(strictnessForNodeType("class")).toEqual({
			strict: true,
			preFilter: "class"
		});
		
		expect(strictnessForNodeType("generic")).toEqual({
			strict: false
		});
		
		expect(strictnessForNodeType(undefined)).toEqual({
			strict: false
		});
	});
	
	test("should generate scope reservation warnings", () => {
		expect(scopeReservationWarnings("file")).toEqual([]);
		expect(scopeReservationWarnings(undefined)).toEqual([]);
		
		const functionWarnings = scopeReservationWarnings("function");
		expect(functionWarnings).toHaveLength(1);
		expect(functionWarnings[0]).toContain("reserved");
		
		const classWarnings = scopeReservationWarnings("class");
		expect(classWarnings).toHaveLength(1);
		expect(classWarnings[0]).toContain("reserved");
	});
	
	test("should attach warnings to results", () => {
		const result = {
			summary: "Test result",
			matchCount: 1,
			method: "test",
			warnings: ["Initial warning"]
		};
		
		const enhanced = attachWarnings(result, ["New warning 1", "New warning 2"]);
		
		expect(enhanced.warnings).toEqual([
			"Initial warning",
			"New warning 1", 
			"New warning 2"
		]);
	});
	
	test("should not modify results when no warnings to attach", () => {
		const result = {
			summary: "Test result",
			matchCount: 1,
			method: "test",
			warnings: ["Initial warning"]
		};
		
		const enhanced = attachWarnings(result, []);
		
		expect(enhanced.warnings).toEqual(["Initial warning"]);
	});
});