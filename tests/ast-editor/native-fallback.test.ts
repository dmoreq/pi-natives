/**
 * Tests for native fallback functionality
 */

import { describe, test, expect } from "bun:test";
import { 
	countLiteralOccurrences, 
	replaceAllLiteral, 
	syntheticNativeChanges,
	formatNativePreview,
	performNativeEdit
} from "../../src/ast-editor/native-fallback";

describe("Native Fallback", () => {
	
	test("should count literal occurrences", () => {
		expect(countLiteralOccurrences("hello world hello", "hello")).toBe(2);
		expect(countLiteralOccurrences("hello world", "xyz")).toBe(0);
		expect(countLiteralOccurrences("", "test")).toBe(0);
		expect(countLiteralOccurrences("test", "")).toBe(0);
	});
	
	test("should replace all literal occurrences", () => {
		expect(replaceAllLiteral("hello world hello", "hello", "hi")).toBe("hi world hi");
		expect(replaceAllLiteral("no match", "xyz", "abc")).toBe("no match");
		expect(replaceAllLiteral("test", "", "replacement")).toBe("test");
	});
	
	test("should generate synthetic native changes", () => {
		const changes = syntheticNativeChanges(3);
		
		expect(changes).toHaveLength(3);
		expect(changes[0]).toEqual({
			line: 1,
			column: 0,
			before: "literal match",
			after: "literal replacement"
		});
		expect(changes[2]).toEqual({
			line: 3,
			column: 0,
			before: "literal match", 
			after: "literal replacement"
		});
	});
	
	test("should format native preview", () => {
		const before = "line 1\nline 2\nline 3";
		const after = "line 1\nmodified line 2\nline 3";
		
		const preview = formatNativePreview("test.txt", before, after);
		
		expect(preview).toContain("--- test.txt (before)");
		expect(preview).toContain("+++ test.txt (after)");
		expect(preview).toContain("-line 2");
		expect(preview).toContain("+modified line 2");
		expect(preview).toContain(" line 1");
		expect(preview).toContain(" line 3");
	});
	
	test("should perform native edit with matches", () => {
		const content = "console.log('hello') and console.log('world')";
		const result = performNativeEdit(content, "console.log", "print", "test.js", false);
		
		expect(result.matchCount).toBe(2);
		expect(result.method).toBe("native-string");
		expect(result.summary).toContain("2 literal occurrences");
		expect(result.warnings).toEqual([]);
		expect(result.preview).toBeUndefined();
	});
	
	test("should perform native edit with preview", () => {
		const content = "hello world";
		const result = performNativeEdit(content, "hello", "hi", "test.txt", true);
		
		expect(result.matchCount).toBe(1);
		expect(result.method).toBe("native-string");
		expect(result.preview).toBeDefined();
		expect(result.changes).toHaveLength(1);
	});
	
	test("should handle no matches found", () => {
		const content = "hello world";
		const result = performNativeEdit(content, "xyz", "abc", "test.txt", false);
		
		expect(result.matchCount).toBe(0);
		expect(result.summary).toContain("No literal matches found");
		expect(result.method).toBe("native-string");
	});
	
	test("should use singular vs plural correctly", () => {
		const content = "test";
		const result1 = performNativeEdit(content, "test", "demo", "file.txt", false);
		expect(result1.summary).toContain("1 literal occurrence");
		
		const result2 = performNativeEdit("test test", "test", "demo", "file.txt", false);
		expect(result2.summary).toContain("2 literal occurrences");
	});
});