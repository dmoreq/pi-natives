/**
 * Tests for broot parser module
 */

import { describe, test, expect } from "bun:test";
import { 
	parsePrintTreeRows, 
	topologyFromPrintTreeStdout 
} from "../../src/broot/broot-parser";

describe("Broot Parser", () => {
	
	test("should parse simple broot print_tree output", () => {
		const output = [
			"project",
			"├── src",
			"│   └── main.ts",
			"└── README.md"
		].join("\n");
		
		const rows = parsePrintTreeRows(output);
		
		expect(rows.length).toBe(3);
		expect(rows.map(r => r.name)).toEqual(["src", "main.ts", "README.md"]);
		expect(rows[0].depth).toBe(1);
		expect(rows[1].depth).toBe(2);
		expect(rows[2].depth).toBe(1);
	});
	
	test("should handle ANSI color codes", () => {
		const colorOutput = `\u001b[32m├── src\u001b[0m
\u001b[31m│   ├── file.ts\u001b[0m`;
		
		const rows = parsePrintTreeRows(colorOutput);
		
		expect(rows[0].name).toBe("src");
		expect(rows[1].name).toBe("file.ts");
	});
	
	test("should strip trailing annotations", () => {
		const annotatedOutput = `├── large-file.txt (15.2K)
├── folder [12 files]`;
		
		const rows = parsePrintTreeRows(annotatedOutput);
		
		expect(rows[0].name).toBe("large-file.txt");
		expect(rows[1].name).toBe("folder");
	});
	
	test("should convert rows to nested topology", () => {
		const output = [
			"root",
			"└── child.txt"
		].join("\n");
		
		const topology = topologyFromPrintTreeStdout(output);
		
		expect(topology).toBeDefined();
		expect(topology!.length).toBe(1);
		
		const first = topology![0];
		expect(first.kind).toBe("file");
		expect(first.name).toBe("child.txt");
		expect(first.relPath).toBe("child.txt");
	});
	
	test("should handle empty output", () => {
		const topology = topologyFromPrintTreeStdout("");
		expect(topology).toBeNull();
	});
	
	test("should classify files correctly", () => {
		const output = [
			"project",
			"├── index.ts", 
			"├── config.json",
			"└── README.md"
		].join("\n");
		
		const topology = topologyFromPrintTreeStdout(output);
		
		expect(topology).toBeDefined();
		const tsFile = topology!.find(n => n.name === "index.ts");
		expect(tsFile!.extension).toBe("ts");
		expect(tsFile!.fileCategory).toBe("code");
		
		const jsonFile = topology!.find(n => n.name === "config.json");
		expect(jsonFile!.extension).toBe("json");
		expect(jsonFile!.fileCategory).toBe("config");
	});
	
	test("should sanitize relative paths", () => {
		const output = [
			"project",
			"├── src",
			"│   └── nested",
			"│       └── file.ts",
			"└── README.md"
		].join("\n");
		
		const topology = topologyFromPrintTreeStdout(output);
		
		expect(topology).toBeDefined();
		const srcDir = topology!.find(n => n.name === "src");
		expect(srcDir).toBeDefined();
		expect(srcDir!.relPath).toBe("src");
		
		if (srcDir!.children && srcDir!.children.length > 0) {
			const nestedDir = srcDir!.children[0];
			expect(nestedDir.relPath).toBe("src/nested");
		}
	});
});