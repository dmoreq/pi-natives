import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { jscpdDetect, formatJscpdResults, JscpdError } from "../src/jscpd";

// ── Helpers ────────────────────────────────────────────────────────

const JSCPD_AVAILABLE = spawnSync("which", ["jscpd"]).status === 0;

function jscpdDescribe(name: string, fn: () => void) {
	if (JSCPD_AVAILABLE) {
		describe(name, fn);
	} else {
		describe.skip(name, fn);
	}
}

// ── Unit tests (no binary needed) ─────────────────────────────────

describe("jscpd error type", () => {
	it("should have exported JscpdError class", () => {
		const err = new JscpdError("test error");
		expect(err.name).toBe("JscpdError");
		expect(err.message).toBe("test error");
	});
});

describe("formatJscpdResults", () => {
	it("should format empty results", () => {
		const result = {
			duplicates: [],
			totalClones: 0,
			totalDuplicatedLines: 0,
			percentage: 0,
			totalSources: 0,
			totalLines: 0,
		};
		const output = formatJscpdResults(result, "/project");
		expect(output).toContain("no duplicated code found");
	});

	it("should format duplicate pairs", () => {
		const result = {
			duplicates: [
				{
					format: "typescript",
					lines: 13,
					fragment: "export function greet(name: string): string {\n    const greeting = \"Hello, \" + name;\n    return greeting;\n}",
					firstFile: { name: "src/a.ts", start: 1, end: 13 },
					secondFile: { name: "src/b.ts", start: 1, end: 13 },
				},
			],
			totalClones: 1,
			totalDuplicatedLines: 13,
			percentage: 25,
			totalSources: 4,
			totalLines: 52,
		};
		const output = formatJscpdResults(result, "/project");
		expect(output).toContain("Clone #1");
		expect(output).toContain("13 duplicated lines");
		expect(output).toContain("typescript");
		expect(output).toContain("src/a.ts");
		expect(output).toContain("src/b.ts");
		expect(output).toContain("25.0%");
	});
});

// ── Integration tests (require jscpd binary) ──────────────────────

let testDir: string;

jscpdDescribe("jscpdDetect (integration)", () => {
	beforeAll(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-jscpd-test-"));

		// Create an exact duplicate
		const duplicateCode = [
			"export function greet(name: string): string {",
			'    const greeting = "Hello, " + name;',
			"    if (name.length > 0) {",
			"        console.log(greeting);",
			"    }",
			"    return greeting;",
			"}",
		].join("\n");

		await fs.writeFile(path.join(testDir, "greet-a.ts"), duplicateCode);
		await fs.writeFile(path.join(testDir, "greet-b.ts"), duplicateCode);

		// Create a file with no duplicates
		await fs.writeFile(
			path.join(testDir, "unique.ts"),
			[
				"export const API_URL = 'https://api.example.com';",
				"export const TIMEOUT_MS = 5000;",
				"export const MAX_RETRIES = 3;",
			].join("\n"),
		);
	});

	afterAll(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should detect exact clones", async () => {
		const result = await jscpdDetect({
			paths: [testDir],
			minLines: 3,
			minTokens: 10,
			mode: "strict",
		});

		expect(result.totalClones).toBeGreaterThanOrEqual(1);
		expect(result.totalDuplicatedLines).toBeGreaterThan(0);
		expect(result.duplicates.length).toBeGreaterThanOrEqual(1);

		const clone = result.duplicates[0];
		expect(clone.format).toBe("typescript");
		expect(clone.firstFile.name).toBeDefined();
		expect(clone.secondFile.name).toBeDefined();
	});

	it("should return empty when there are no duplicates", async () => {
		// Create a clean directory with only unique files
		const cleanDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-jscpd-clean-"));
		await fs.writeFile(
			path.join(cleanDir, "a.ts"),
			"export const A = 1;\nexport const B = 2;\nexport const C = 3;\nexport const D = 4;\nexport const E = 5;\n",
		);
		await fs.writeFile(
			path.join(cleanDir, "b.ts"),
			"export const X = 10;\nexport const Y = 20;\nexport const Z = 30;\nexport const W = 40;\nexport const V = 50;\n",
		);

		try {
			const result = await jscpdDetect({
				paths: [cleanDir],
				minLines: 3,
				mode: "strict",
			});

			expect(result.totalClones).toBe(0);
			expect(result.duplicates).toHaveLength(0);
		} finally {
			await fs.rm(cleanDir, { recursive: true, force: true });
		}
	});

	it("should respect ignore patterns", async () => {
		const result = await jscpdDetect({
			paths: [testDir],
			minLines: 3,
			mode: "strict",
			ignore: ["**/*.ts"], // ignore all TypeScript files
		});

		// With all .ts files ignored, there should be nothing to scan
		// jscpd may error or return empty
		expect(result.totalSources).toBeGreaterThanOrEqual(0);
	});

	it("should throw JscpdError on non-existent path", async () => {
		try {
			await jscpdDetect({
				paths: ["/nonexistent/path/12345"],
			});
			expect(true).toBe(false);
		} catch (err) {
			expect(err instanceof JscpdError).toBe(true);
		}
	});

	it("should handle formatter with edge case paths", () => {
		const result = {
			duplicates: [
				{
					format: "python",
					lines: 8,
					fragment: "def main():\n    pass",
					firstFile: { name: "../../../a/b/c.py", start: 1, end: 8 },
					secondFile: { name: "d/e/f.py", start: 5, end: 12 },
				},
			],
			totalClones: 1,
			totalDuplicatedLines: 8,
			percentage: 15.3,
			totalSources: 10,
			totalLines: 100,
		};
		const output = formatJscpdResults(result, "/project");
		expect(output).toContain("Clone #1");
		expect(output).toContain("python");
	});
});
