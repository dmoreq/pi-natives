import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { astGrepSearch, formatAstGrepResults, AstGrepError, type AstGrepResult, type AstGrepMatch } from "../src/ast-grep";

// ── Helpers ────────────────────────────────────────────────────────

const ASTGREP_AVAILABLE = spawnSync("which", ["ast-grep"]).status === 0;

function astGrepDescribe(name: string, fn: () => void) {
	if (ASTGREP_AVAILABLE) {
		describe(name, fn);
	} else {
		describe.skip(name, fn);
	}
}

// ── Fixtures ───────────────────────────────────────────────────────

const FIXTURE_EMPTY = "[]";
const FIXTURE_WITH_MATCHES = JSON.stringify([
	{
		text: 'eval("test")',
		range: {
			byteOffset: { start: 17, end: 29 },
			start: { line: 0, column: 17 },
			end: { line: 0, column: 29 },
		},
		file: "src/unsafe.ts",
		lines: 'function foo() { eval("test"); }',
		charCount: { leading: 17, trailing: 27 },
		language: "TypeScript",
		metaVariables: {
			single: {},
			multi: {
				A: [{ text: '"test"', range: { byteOffset: { start: 22, end: 28 }, start: { line: 0, column: 22 }, end: { line: 0, column: 28 } } }],
			},
			transformed: {},
		},
	},
	{
		text: "x == x",
		range: {
			byteOffset: { start: 40, end: 47 },
			start: { line: 1, column: 8 },
			end: { line: 1, column: 15 },
		},
		file: "src/unsafe.ts",
		lines: "if (x == x) { return; }",
		charCount: { leading: 8, trailing: 15 },
		language: "TypeScript",
		metaVariables: {
			single: { X: { text: "x", range: { byteOffset: { start: 40, end: 41 }, start: { line: 1, column: 8 }, end: { line: 1, column: 9 } } } },
			multi: {},
			transformed: {},
		},
	},
]);

// ── Formatter unit tests (no binary needed) ────────────────────────

describe("ast-grep formatter", () => {
	it("should format empty results", () => {
		const result: AstGrepResult = {
			matches: [],
			totalMatches: 0,
			filesScanned: 0,
			warnings: [],
		};
		const output = formatAstGrepResults(result, "/project");
		expect(output).toContain("no structural matches found");
	});

	it("should format matches grouped by file", () => {
		const result: AstGrepResult = {
			matches: [
				{
					text: 'eval("test")',
					file: "/project/src/unsafe.ts",
					lines: 'function foo() { eval("test"); }',
					language: "TypeScript",
					line: 0,
					column: 17,
					byteStart: 17,
					byteEnd: 29,
					metaVariables: { single: {}, multi: { A: [{ text: '"test"', line: 0, column: 22 }] } },
				},
			],
			totalMatches: 1,
			filesScanned: 1,
			warnings: [],
		};
		const output = formatAstGrepResults(result, "/project");
		expect(output).toContain("src/unsafe.ts");
		expect(output).toContain("eval");
		expect(output).toContain("$$$A=");
	});

	it("should include warnings in output", () => {
		const result: AstGrepResult = {
			matches: [],
			totalMatches: 0,
			filesScanned: 2,
			warnings: ["Warning: Pattern is too broad", "Help: Try using playground"],
		};
		const output = formatAstGrepResults(result, "/project");
		expect(output).toContain("no structural matches found");
		expect(output).toContain("Warnings:");
		expect(output).toContain("Pattern is too broad");
	});

	it("should handle single metavariable display", () => {
		const result: AstGrepResult = {
			matches: [
				{
					text: "x == x",
					file: "/project/src/test.ts",
					lines: "if (x == x) { }",
					language: "TypeScript",
					line: 3,
					column: 4,
					byteStart: 50,
					byteEnd: 57,
					metaVariables: {
						single: { X: { text: "x", line: 3, column: 4 } },
						multi: {},
					},
				},
			],
			totalMatches: 1,
			filesScanned: 1,
			warnings: [],
		};
		const output = formatAstGrepResults(result, "/project");
		expect(output).toContain("$X=x");
	});
});

// ── Error type unit tests ─────────────────────────────────────────

describe("ast-grep error type", () => {
	it("should have exported AstGrepError class", () => {
		const err = new AstGrepError("test error");
		expect(err.name).toBe("AstGrepError");
		expect(err.message).toBe("test error");
	});
});

// ── Integration tests (require ast-grep binary) ────────────────────

let testDir: string;

astGrepDescribe("astGrepSearch (integration)", () => {
	beforeAll(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-astgrep-test-"));

		// TypeScript file with eval and self-comparison
		await fs.writeFile(
			path.join(testDir, "unsafe.ts"),
			[
				"// Test file with intentional patterns",
				'const userInput = "test";',
				"const result = eval(userInput);",
				"",
				"function check(x: number) {",
				"    if (x == x) {",
				"        console.log('self-comparison');",
				"    }",
				"}",
			].join("\n"),
		);

		// Python file with print calls
		await fs.writeFile(
			path.join(testDir, "main.py"),
			[
				"# Simple Python file",
				"def main():",
				'    print("hello")',
				'    print("world")',
				"",
				"if __name__ == '__main__':",
				"    main()",
			].join("\n"),
		);
	});

	afterAll(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should find eval() calls with metavariables", async () => {
		const result = await astGrepSearch({
			pattern: "eval($$$A)",
			language: "ts",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		const match = result.matches.find(m => m.text.includes("eval"));
		expect(match).toBeDefined();
		expect(match!.metaVariables.multi.A).toBeDefined();
	});

	it("should find self-comparison pattern ($X == $X)", async () => {
		const result = await astGrepSearch({
			pattern: "$X == $X",
			language: "ts",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		const match = result.matches.find(m => m.text.includes("=="));
		expect(match).toBeDefined();
		expect(match!.metaVariables.single.X).toBeDefined();
	});

	it("should work with Python files", async () => {
		const result = await astGrepSearch({
			pattern: "print($$$ARGS)",
			language: "py",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(2);
	});

	it("should return empty for no matches", async () => {
		const result = await astGrepSearch({
			pattern: "nonexistent_func_xyz($$$A)",
			language: "ts",
			path: testDir,
		});

		expect(result.totalMatches).toBe(0);
		expect(result.matches).toHaveLength(0);
	});

	it("should throw AstGrepError for non-existent path", async () => {
		try {
			await astGrepSearch({
				pattern: "eval($$$A)",
				language: "ts",
				path: "/nonexistent/path/12345",
			});
			expect(true).toBe(false);
		} catch (err) {
			expect(err instanceof AstGrepError).toBe(true);
		}
	});

	it("should format results as human-readable", () => {
		const result: AstGrepResult = {
			matches: [
				{
					text: 'eval("test")',
					file: path.join(testDir, "unsafe.ts"),
					lines: 'const result = eval("test");',
					language: "TypeScript",
					line: 2,
					column: 17,
					byteStart: 70,
					byteEnd: 82,
					metaVariables: { single: {}, multi: { A: [{ text: '"test"', line: 2, column: 22 }] } },
				},
			],
			totalMatches: 1,
			filesScanned: 1,
			warnings: [],
		};
		const output = formatAstGrepResults(result, testDir);
		expect(output).toContain("unsafe.ts");
		expect(output).toContain("line 3");
		expect(output).toContain("eval");
	});
});
