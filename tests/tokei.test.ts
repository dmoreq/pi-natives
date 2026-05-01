import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { tokeiCount, formatTokeiResults, TokeiError } from "../src/tokei";

// ── Helpers ────────────────────────────────────────────────────────

const TOKEI_AVAILABLE = spawnSync("which", ["tokei"]).status === 0;

function tokeiDescribe(name: string, fn: () => void) {
	if (TOKEI_AVAILABLE) {
		describe(name, fn);
	} else {
		describe.skip(name, fn);
	}
}

// ── Unit tests (no binary needed) ─────────────────────────────────

describe("tokei error type", () => {
	it("should have exported TokeiError class", () => {
		const err = new TokeiError("test error");
		expect(err.name).toBe("TokeiError");
		expect(err.message).toBe("test error");
	});
});

describe("formatTokeiResults", () => {
	it("should format empty results", () => {
		const result = {
			languages: { Total: { blanks: 0, code: 0, comments: 0, lines: 0, files: [], inaccurate: false } },
			total: { blanks: 0, code: 0, comments: 0, lines: 0, files: [], inaccurate: false },
		};
		const output = formatTokeiResults(result);
		expect(output).toContain("no code found");
	});

	it("should format language stats in a table", () => {
		const result = {
			languages: {
				TypeScript: { blanks: 10, code: 50, comments: 5, lines: 65, files: [{ name: "src/index.ts", blanks: 10, code: 50, comments: 5 }], inaccurate: false },
				Rust: { blanks: 3, code: 20, comments: 2, lines: 25, files: [{ name: "src/main.rs", blanks: 3, code: 20, comments: 2 }], inaccurate: false },
				Total: { blanks: 13, code: 70, comments: 7, lines: 90, files: [], inaccurate: false },
			},
			total: { blanks: 13, code: 70, comments: 7, lines: 90, files: [], inaccurate: false },
		};
		const output = formatTokeiResults(result);
		expect(output).toContain("TypeScript");
		expect(output).toContain("Rust");
		expect(output).toContain("Total");
		expect(output).toContain("50");
		expect(output).toContain("20");
		expect(output).toContain("90");
	});
});

// ── Integration tests (require tokei binary) ──────────────────────

let testDir: string;

tokeiDescribe("tokeiCount (integration)", () => {
	beforeAll(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-tokei-test-"));

		await fs.mkdir(path.join(testDir, "src"), { recursive: true });

		await fs.writeFile(
			path.join(testDir, "src", "main.ts"),
			[
				"// Main entry point",
				"import { foo } from './foo';",
				"",
				"export function main() {",
				"    // Call the helper",
				"    const result = foo(42);",
				"    return result;",
				"}",
				"",
				"main();",
			].join("\n"),
		);

		await fs.writeFile(
			path.join(testDir, "src", "foo.ts"),
			[
				"// Helper function",
				"export function foo(x: number): number {",
				"    return x * 2;",
				"}",
			].join("\n"),
		);

		await fs.writeFile(
			path.join(testDir, "README.md"),
			[
				"# Test Project",
				"",
				"This is a test project for pi-sherlock.",
				"",
				"## Usage",
				"",
				"Run with `bun test`.",
			].join("\n"),
		);
	});

	afterAll(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should count lines of code by language", async () => {
		const result = await tokeiCount({
			paths: [testDir],
		});

		expect(result.total.code).toBeGreaterThan(0);
		expect(result.total.lines).toBeGreaterThan(0);
		expect(result.languages).toBeDefined();

		const langs = Object.keys(result.languages).filter(k => k !== "Total");
		expect(langs.length).toBeGreaterThanOrEqual(2); // TypeScript + Markdown
	});

	it("should include per-file stats when files=true", async () => {
		const result = await tokeiCount({
			paths: [testDir],
			files: true,
		});

		const ts = result.languages["TypeScript"];
		expect(ts).toBeDefined();
		expect(ts.files.length).toBeGreaterThanOrEqual(2);
	});

	it("should filter by language types", async () => {
		const result = await tokeiCount({
			paths: [testDir],
			types: ["TypeScript"],
		});

		const langs = Object.keys(result.languages).filter(k => k !== "Total");
		expect(langs).toContain("TypeScript");
		expect(langs).not.toContain("Markdown");
	});

	it("should throw TokeiError on non-existent path", async () => {
		try {
			await tokeiCount({
				paths: ["/nonexistent/path/12345"],
			});
			expect(true).toBe(false);
		} catch (err) {
			expect(err instanceof TokeiError).toBe(true);
		}
	});
});
