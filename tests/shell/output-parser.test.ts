/**
 * Tests for shell output parsing
 */

import { describe, test, expect } from "bun:test";
import { 
	safeJsonParse,
	extractJson,
	parseNushellTable,
	tryInterpretStructured
} from "../../src/shell/output-parser";

describe("Output Parser", () => {
	
	test("should safely parse JSON", () => {
		expect(safeJsonParse('{"key": "value"}')).toEqual({ key: "value" });
		expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
		expect(safeJsonParse('invalid json')).toBeUndefined();
		expect(safeJsonParse('')).toBeUndefined();
	});
	
	test("should extract JSON from mixed output", () => {
		const mixed1 = 'Some text\n{"data": "value"}\nMore text';
		expect(extractJson(mixed1)).toEqual({ data: "value" });
		
		const mixed2 = 'Prefix [1, 2, 3] suffix';
		expect(extractJson(mixed2)).toEqual([1, 2, 3]);
		
		expect(extractJson('No JSON here')).toBeUndefined();
		expect(extractJson('')).toBeUndefined();
	});
	
	test("should handle nested JSON extraction", () => {
		const nested = 'Text {"outer": {"inner": [1, 2]}} end';
		expect(extractJson(nested)).toEqual({ outer: { inner: [1, 2] } });
	});
	
	test("should parse Nushell ASCII tables", () => {
		const table = [
			"name | size | type",
			"-----|------|-----",
			"file1.txt | 100 | file",
			"folder1 | - | dir"
		].join("\n");
		
		const result = parseNushellTable(table);
		
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			name: "file1.txt",
			size: "100", 
			type: "file"
		});
		expect(result[1]).toEqual({
			name: "folder1",
			size: "-",
			type: "dir"
		});
	});
	
	test("should handle tables without separator line", () => {
		const table = [
			"col1 | col2",
			"val1 | val2",
			"val3 | val4"
		].join("\n");
		
		const result = parseNushellTable(table);
		
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ col1: "val1", col2: "val2" });
		expect(result[1]).toEqual({ col1: "val3", col2: "val4" });
	});
	
	test("should return empty array for invalid tables", () => {
		expect(parseNushellTable("")).toEqual([]);
		expect(parseNushellTable("no pipes here")).toEqual([]);
		expect(parseNushellTable("header only | with pipes")).toEqual([]);
	});
	
	test("should interpret structured output", () => {
		// JSON output
		const json1 = tryInterpretStructured('{"key": "value"}');
		expect(json1.structured).toBe(true);
		expect(json1.output).toEqual({ key: "value" });
		
		// Array output
		const json2 = tryInterpretStructured('[1, 2, 3]');
		expect(json2.structured).toBe(true);
		expect(json2.output).toEqual([1, 2, 3]);
		
		// Mixed JSON output
		const mixed = tryInterpretStructured('Header\n{"data": "test"}\nFooter');
		expect(mixed.structured).toBe(true);
		expect(mixed.output).toEqual({ data: "test" });
		
		// Table output
		const table = tryInterpretStructured('name | value\ntest | 123');
		expect(table.structured).toBe(true);
		expect(Array.isArray(table.output)).toBe(true);
		
		// Plain text
		const plain = tryInterpretStructured('Plain text output');
		expect(plain.structured).toBe(false);
		expect(plain.output).toBe('Plain text output');
		
		// Empty input
		const empty = tryInterpretStructured('');
		expect(empty.structured).toBe(false);
		expect(empty.output).toBe('');
	});
	
	test("should prioritize JSON over table parsing", () => {
		const jsonWithPipes = tryInterpretStructured('{"data": "value | with | pipes"}');
		expect(jsonWithPipes.structured).toBe(true);
		expect(jsonWithPipes.output).toEqual({ data: "value | with | pipes" });
	});
	
	test("should handle malformed table gracefully", () => {
		const malformed = tryInterpretStructured('col1 | col2\n| | |');
		expect(malformed.structured).toBe(false);
		expect(malformed.output).toBe('col1 | col2\n| | |');
	});
});