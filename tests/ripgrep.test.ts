import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { grep, type GrepOptions, GrepError } from "../src/ripgrep";

let testDir: string;

async function setupFixtures() {
	testDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-grep-test-"));

	await fs.writeFile(
		path.join(testDir, "file1.ts"),
		[
			"import { foo } from './foo';",
			"",
			"export function hello() {",
			"    // TODO: implement this",
			'    return "hello";',
			"}",
			"",
			"// FIXME: refactor this module",
		].join("\n"),
	);

	await fs.writeFile(
		path.join(testDir, "file2.ts"),
		[
			"import { bar } from './bar';",
			"",
			"export function world() {",
			"    // FIXME: fix this function",
			'    return "world";',
			"}",
			"",
			"const greeting = 'hello world';",
		].join("\n"),
	);

	await fs.writeFile(
		path.join(testDir, "readme.md"),
		[
			"# Test README",
			"",
			"This is a test file for pi-sherlock.",
			"It has multiple lines.",
			"",
			"## Section 2",
			"",
			"More content here.",
		].join("\n"),
	);

	await fs.writeFile(
		path.join(testDir, "hidden.txt"),
		"This is a hidden file.\n",
	);

	await fs.writeFile(
		path.join(testDir, "large.txt"),
		Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: sample content for testing`).join("\n"),
	);

	// Create a subdirectory with more files
	await fs.mkdir(path.join(testDir, "subdir"));
	await fs.writeFile(
		path.join(testDir, "subdir", "helper.ts"),
		[
			"export function helper() {",
			"    // TODO: implement helper",
			'    return "helper";',
			"}",
		].join("\n"),
	);
}

async function cleanupFixtures() {
	await fs.rm(testDir, { recursive: true, force: true });
}

describe("grep (ripgrep wrapper)", () => {
	beforeAll(async () => {
		await setupFixtures();
	});

	afterAll(async () => {
		await cleanupFixtures();
	});

	it("should find basic pattern matches", async () => {
		const result = await grep({
			pattern: "TODO",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(2);
		expect(result.filesWithMatches).toBeGreaterThanOrEqual(2);
		expect(result.matches.length).toBeGreaterThanOrEqual(2);
		expect(result.matches.some(m => m.path.endsWith("file1.ts"))).toBe(true);
	});

	it("should do case-insensitive search", async () => {
		const result = await grep({
			pattern: "hello",
			path: testDir,
			ignoreCase: true,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(2); // "hello" in file1.ts and "hello world" in file2.ts
	});

	it("should respect glob filter", async () => {
		const result = await grep({
			pattern: "TODO",
			path: testDir,
			glob: "*.md",
		});

		// Only .md files — should have 0 TODO matches
		expect(result.totalMatches).toBe(0);
	});

	it("should return context lines", async () => {
		const result = await grep({
			pattern: "TODO",
			path: testDir,
			contextBefore: 1,
			contextAfter: 1,
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		const matchWithContext = result.matches.find(m => m.contextBefore && m.contextBefore.length > 0);
		expect(matchWithContext).toBeDefined();
		expect(matchWithContext!.contextBefore!.length).toBeGreaterThanOrEqual(1);
	});

	it("should limit matches with maxCount", async () => {
		const result = await grep({
			pattern: "function",
			path: testDir,
			maxCount: 1,
		});

		expect(result.matches.length).toBeLessThanOrEqual(1);
	});

	it("should skip matches with offset", async () => {
		const allResults = await grep({
			pattern: "function",
			path: testDir,
		});

		const skippedResults = await grep({
			pattern: "function",
			path: testDir,
			offset: 1,
		});

		// Skipped results should have fewer matches (or potentially 0 if only 1 match total)
		expect(skippedResults.matches.length).toBeLessThanOrEqual(allResults.matches.length);
	});

	it("should handle no matches gracefully", async () => {
		const result = await grep({
			pattern: "XYZZY_NONEXISTENT_PATTERN_12345",
			path: testDir,
		});

		expect(result.totalMatches).toBe(0);
		expect(result.matches).toHaveLength(0);
		expect(result.filesWithMatches).toBe(0);
	});

	it("should handle pattern in subdirectory", async () => {
		const result = await grep({
			pattern: "helper",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		expect(result.matches.some(m => m.path.includes("subdir"))).toBe(true);
	});

	it("should handle empty pattern", async () => {
		const result = await grep({
			pattern: "",
			path: testDir,
		});

		expect(result.totalMatches).toBe(0);
	});

	it("should work with count mode", async () => {
		const result = await grep({
			pattern: "function",
			path: testDir,
			mode: "count",
		});

		// In count mode, matches have matchCount field
		expect(result.filesSearched).toBeGreaterThan(0);
		expect(result.totalMatches).toBeGreaterThanOrEqual(3); // 3 functions: hello, world, helper
	});

	it("should work with filesWithMatches mode", async () => {
		const result = await grep({
			pattern: "TODO",
			path: testDir,
			mode: "filesWithMatches",
		});

		expect(result.filesWithMatches).toBeGreaterThanOrEqual(2);
		expect(result.matches.length).toBeGreaterThanOrEqual(2);
		// Each match should have path but no line content
		for (const match of result.matches) {
			expect(match.line).toBe("");
		}
	});

	it("should throw GrepError on invalid pattern", async () => {
		// rg with an invalid regex should error
		try {
			await grep({
				pattern: "[unclosed",
				path: testDir,
			});
			// Should not reach here
			expect(true).toBe(false);
		} catch (err) {
			expect(err instanceof GrepError).toBe(true);
		}
	});

	it("should handle specific file search", async () => {
		const result = await grep({
			pattern: "TODO",
			path: path.join(testDir, "file1.ts"),
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		// Should only search the one file
		for (const match of result.matches) {
			expect(match.path).toMatch(/file1\.ts$/);
		}
	});
});
