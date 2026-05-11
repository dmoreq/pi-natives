/**
 * Tests for shell pipeline enhancement
 */

import { describe, test, expect } from "bun:test";
import { 
	isStructurableCommand,
	enforceJsonPipeline,
	sanitizeKey,
	splitPipeCells
} from "../../src/shell/pipeline-enhancer";

describe("Pipeline Enhancer", () => {
	
	test("should identify structurable commands", () => {
		expect(isStructurableCommand("ls")).toBe(true);
		expect(isStructurableCommand("ls -la")).toBe(true);
		expect(isStructurableCommand("env")).toBe(true);
		expect(isStructurableCommand("pwd")).toBe(true);
		expect(isStructurableCommand("ps")).toBe(true);
		expect(isStructurableCommand("git log")).toBe(true);
		expect(isStructurableCommand("git status")).toBe(true);
		
		expect(isStructurableCommand("echo hello")).toBe(false);
		expect(isStructurableCommand("cat file.txt")).toBe(false);
		expect(isStructurableCommand("unknown-command")).toBe(false);
	});
	
	test("should enhance ls commands", () => {
		const result1 = enforceJsonPipeline("ls");
		expect(result1.nuScript).toBe("ls  | to json");
		expect(result1.enhanced).toBe(true);
		
		const result2 = enforceJsonPipeline("ls -la");
		expect(result2.nuScript).toBe("ls -la | to json");
		expect(result2.enhanced).toBe(true);
	});
	
	test("should enhance env commands", () => {
		const result1 = enforceJsonPipeline("env");
		expect(result1.nuScript).toBe("env | to json");
		expect(result1.enhanced).toBe(true);
		
		const result2 = enforceJsonPipeline("env | sort");
		expect(result2.nuScript).toBe("env | to json");
		expect(result2.enhanced).toBe(true);
	});
	
	test("should enhance pwd commands", () => {
		const result = enforceJsonPipeline("pwd");
		expect(result.nuScript).toBe("pwd | to json");
		expect(result.enhanced).toBe(true);
	});
	
	test("should enhance ps commands", () => {
		const result1 = enforceJsonPipeline("ps");
		expect(result1.nuScript).toBe("ps  | to json");
		expect(result1.enhanced).toBe(true);
		
		const result2 = enforceJsonPipeline("ps aux");
		expect(result2.nuScript).toBe("ps aux | to json");
		expect(result2.enhanced).toBe(true);
	});
	
	test("should enhance git log commands", () => {
		const result1 = enforceJsonPipeline("git log");
		expect(result1.nuScript).toBe("git log --format=json | to json");
		expect(result1.enhanced).toBe(true);
		
		const result2 = enforceJsonPipeline("git log --oneline");
		expect(result2.nuScript).toBe("git log --oneline --format=json | to json");
		expect(result2.enhanced).toBe(true);
		
		const result3 = enforceJsonPipeline("git log --format=short");
		expect(result3.nuScript).toBe("git log --format=short | to json");
		expect(result3.enhanced).toBe(true);
	});
	
	test("should enhance git status commands", () => {
		const result1 = enforceJsonPipeline("git status");
		expect(result1.nuScript).toBe("git status --porcelain | to json");
		expect(result1.enhanced).toBe(true);
		
		const result2 = enforceJsonPipeline("git status --porcelain");
		expect(result2.nuScript).toBe("git status --porcelain | to json");
		expect(result2.enhanced).toBe(true);
	});
	
	test("should not enhance unrecognized commands", () => {
		const result = enforceJsonPipeline("echo hello");
		expect(result.nuScript).toBe("echo hello");
		expect(result.enhanced).toBe(false);
	});
	
	test("should sanitize table keys", () => {
		expect(sanitizeKey("Column Name")).toBe("column_name");
		expect(sanitizeKey("Special@Chars!")).toBe("special_chars_");
		expect(sanitizeKey("multiple   spaces")).toBe("multiple___spaces");
		expect(sanitizeKey("MixedCase")).toBe("mixedcase");
	});
	
	test("should split pipe-delimited cells", () => {
		expect(splitPipeCells("col1 | col2 | col3")).toEqual(["col1", "col2", "col3"]);
		expect(splitPipeCells("  spaced  |  values  ")).toEqual(["spaced", "values"]);
		expect(splitPipeCells("single")).toEqual(["single"]);
		expect(splitPipeCells("")).toEqual([""]);
	});
});