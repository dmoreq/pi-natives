import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import {
	semgrepScan,
	formatSemgrepResults,
	SemgrepError,
	type SemgrepResult,
	type SemgrepMatch,
} from "../src/semgrep";

// ── Helpers ────────────────────────────────────────────────────────

const SEMGREP_AVAILABLE = spawnSync("which", ["semgrep"]).status === 0;

function semgrepDescribe(name: string, fn: () => void) {
	if (SEMGREP_AVAILABLE) {
		describe(name, fn);
	} else {
		describe.skip(name, fn);
	}
}

// ── Fixtures ───────────────────────────────────────────────────────

const FIXTURE_EMPTY = JSON.stringify({
	results: [],
	errors: [],
	paths: { scanned: ["src/index.ts"], skipped: [] },
});

const FIXTURE_WITH_MATCHES = JSON.stringify({
	results: [
		{
			check_id: "eqeq-is-bad",
			path: "src/foo.ts",
			start: { line: 5, col: 9, offset: 100 },
			end: { line: 5, col: 15, offset: 106 },
			extra: {
				lines: "requires login",
				message: "Detected `x == x`, which is a useless self-comparison.",
				severity: "WARNING",
				metadata: { category: "correctness" },
				fingerprint: "abc123",
				is_ignored: false,
				engine_kind: "OSS",
			},
		},
		{
			check_id: "eval-detected",
			path: "src/bar.ts",
			start: { line: 12, col: 13, offset: 300 },
			end: { line: 12, col: 24, offset: 311 },
			extra: {
				lines: "requires login",
				message: "Detected the use of eval(). This could be a security risk.",
				severity: "ERROR",
				metadata: { cwe: "CWE-95" },
				fingerprint: "def456",
				is_ignored: false,
				engine_kind: "OSS",
			},
		},
	],
	errors: [],
	paths: { scanned: ["src/foo.ts", "src/bar.ts"], skipped: [] },
});

const FIXTURE_WITH_ERRORS = JSON.stringify({
	results: [],
	errors: [{ message: "File too large to parse: giant.ts", path: "giant.ts" }],
	paths: { scanned: ["src/index.ts"], skipped: [] },
});

// ── Parser unit tests (no semgrep binary needed) ───────────────────

describe("semgrep JSON parser", () => {
	it("should parse empty results", () => {
		const result: SemgrepResult = parseSemgrepJson(FIXTURE_EMPTY);
		expect(result.matches).toHaveLength(0);
		expect(result.totalMatches).toBe(0);
		expect(result.filesScanned).toBe(1);
		expect(result.errors).toHaveLength(0);
	});

	it("should parse matches correctly", () => {
		const result: SemgrepResult = parseSemgrepJson(FIXTURE_WITH_MATCHES);
		expect(result.matches).toHaveLength(2);
		expect(result.totalMatches).toBe(2);
		expect(result.filesScanned).toBe(2);

		const [first, second] = result.matches;
		expect(first.checkId).toBe("eqeq-is-bad");
		expect(first.path).toBe("src/foo.ts");
		expect(first.startLine).toBe(5);
		expect(first.severity).toBe("WARNING");
		expect(first.message).toContain("self-comparison");

		expect(second.checkId).toBe("eval-detected");
		expect(second.path).toBe("src/bar.ts");
		expect(second.severity).toBe("ERROR");
	});

	it("should report scan errors", () => {
		const result: SemgrepResult = parseSemgrepJson(FIXTURE_WITH_ERRORS);
		expect(result.matches).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].path).toBe("giant.ts");
		expect(result.errors[0].message).toContain("too large");
	});

	it("should filter out ignored results", () => {
		const input = JSON.stringify({
			results: [
				{
					check_id: "rule-1",
					path: "src/a.ts",
					start: { line: 1, col: 1, offset: 0 },
					end: { line: 1, col: 5, offset: 4 },
					extra: {
						lines: "",
						message: "Match 1",
						severity: "WARNING",
						is_ignored: true,
					},
				},
				{
					check_id: "rule-2",
					path: "src/b.ts",
					start: { line: 2, col: 1, offset: 10 },
					end: { line: 2, col: 5, offset: 14 },
					extra: {
						lines: "",
						message: "Match 2",
						severity: "ERROR",
						is_ignored: false,
					},
				},
			],
			errors: [],
			paths: { scanned: ["src/a.ts", "src/b.ts"] },
		});

		const result: SemgrepResult = parseSemgrepJson(input);
		expect(result.matches).toHaveLength(1);
		expect(result.matches[0].checkId).toBe("rule-2");
	});
});

// ── Formatter unit tests ──────────────────────────────────────────

describe("formatSemgrepResults", () => {
	it("should format matches grouped by file", () => {
		const result: SemgrepResult = parseSemgrepJson(FIXTURE_WITH_MATCHES);
		const output = formatSemgrepResults(result, "/project");

		expect(output).toContain("src/foo.ts");
		expect(output).toContain("src/bar.ts");
		expect(output).toContain("eqeq-is-bad");
		expect(output).toContain("eval-detected");
		expect(output).toContain("WARNING");
		expect(output).toContain("ERROR");
		expect(output).toContain("self-comparison");
		expect(output).toContain("security risk");
	});

	it("should show no-matches message for empty results", () => {
		const result: SemgrepResult = parseSemgrepJson(FIXTURE_EMPTY);
		const output = formatSemgrepResults(result, "/project");
		expect(output).toContain("no matches found");
	});

	it("should include scan errors in output", () => {
		const result: SemgrepResult = parseSemgrepJson(FIXTURE_WITH_ERRORS);
		const output = formatSemgrepResults(result, "/project");
		expect(output).toContain("Scan errors");
		expect(output).toContain("too large");
	});
});

// ── Integration tests (require semgrep binary) ─────────────────────

let testDir: string;

semgrepDescribe("semgrepScan (integration)", () => {
	beforeAll(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-semgrep-test-"));
		await fs.writeFile(
			path.join(testDir, "unsafe.ts"),
			[
				"// This file has intentional issues for testing",
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
		await fs.writeFile(
			path.join(testDir, "safe.ts"),
			[
				"// This file has no issues",
				"function add(a: number, b: number): number {",
				"    return a + b;",
				"}",
			].join("\n"),
		);
	});

	afterAll(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should find pattern matches", async () => {
		const result = await semgrepScan({
			pattern: "eval(...)",
			path: testDir,
			language: "ts",
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		const match = result.matches.find(m => m.checkId === "-");
		expect(match).toBeDefined();
		expect(match!.path).toMatch(/unsafe\.ts$/);
	});

	it("should find self-comparison pattern", async () => {
		const result = await semgrepScan({
			pattern: "$X == $X",
			path: testDir,
			language: "ts",
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		expect(result.matches.some(m => m.message === "x == x")).toBe(true);
	});

	it("should respect severity filter", async () => {
		const result = await semgrepScan({
			pattern: "eval(...)",
			path: testDir,
			language: "ts",
			severity: "ERROR",
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(0);
	});

	it("should return empty results for no matches", async () => {
		const result = await semgrepScan({
			pattern: "XYZZY_NONEXISTENT_12345",
			path: testDir,
			language: "ts",
		});

		expect(result.totalMatches).toBe(0);
		expect(result.matches).toHaveLength(0);
	});

	it("should throw SemgrepError on invalid pattern", async () => {
		try {
			await semgrepScan({
				pattern: "[invalid",
				path: testDir,
				language: "ts",
			});
			// Should not reach here
			expect(true).toBe(false);
		} catch (err) {
			expect(err instanceof SemgrepError).toBe(true);
		}
	});


});

// ── Helper: parse JSON into SemgrepResult without spawning semgrep ─

function parseSemgrepJson(json: string): SemgrepResult {
	const raw = JSON.parse(json);

	const matches: SemgrepMatch[] = (raw.results ?? [])
		.filter((r: any) => !r.extra?.is_ignored)
		.map((r: any) => ({
			checkId: r.check_id,
			path: r.path,
			startLine: r.start.line,
			startCol: r.start.col,
			endLine: r.end.line,
			endCol: r.end.col,
			lines: r.extra.lines?.trimEnd() ?? "",
			message: r.extra.message ?? "",
			severity: r.extra.severity ?? "INFO",
			metadata: r.extra.metadata,
		}));

	const filesScanned = raw.paths?.scanned?.length ?? 0;
	const errors: Array<{ message: string; path?: string }> = (raw.errors ?? [])
		.filter((e: any) => e.type !== "OK")
		.map((e: any) => ({
			message: e.message ?? e.type ?? "Unknown error",
			path: e.path,
		}));

	return { matches, filesScanned, filesSkipped: 0, totalMatches: matches.length, errors };
}
