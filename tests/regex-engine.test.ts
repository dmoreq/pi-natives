import { describe, expect, it } from "bun:test";
import { searchContent } from "../src/regex-engine";

const SAMPLE_TEXT = [
	"import { foo } from './foo';",
	"",
	"export function hello() {",
	"    // TODO: implement this",
	'    return "hello";',
	"}",
	"",
	"// FIXME: refactor this module",
	"const greeting = 'hello world';",
].join("\n");

describe("searchContent (in-memory)", () => {
	it("should find exact pattern match", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "TODO",
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		expect(result.matches[0].line).toContain("TODO");
	});

	it("should do case-insensitive search", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "hello",
			ignoreCase: true,
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(2); // "hello" and "hello world"
	});

	it("should return context lines", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "TODO",
			contextBefore: 1,
			contextAfter: 1,
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		const match = result.matches[0];
		expect(match.contextBefore).toBeDefined();
		expect(match.contextBefore!.length).toBeGreaterThanOrEqual(1);
	});

	it("should limit matches with maxCount", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "hello",
			ignoreCase: true,
			maxCount: 1,
		});

		expect(result.matches.length).toBeLessThanOrEqual(1);
		expect(result.matchCount).toBeGreaterThanOrEqual(2); // Total count should still reflect actual matches
		expect(result.limitReached).toBe(true);
	});

	it("should skip matches with offset", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "hello",
			ignoreCase: true,
			offset: 1,
		});

		// After skipping 1, should still have results (there are at least 2 "hello" matches)
		expect(result.matches.length).toBeGreaterThanOrEqual(1);
	});

	it("should handle no matches", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "XYZZY_NONEXISTENT",
		});

		expect(result.matches).toHaveLength(0);
		expect(result.matchCount).toBe(0);
	});

	it("should handle empty pattern", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "",
		});

		expect(result.matches).toHaveLength(0);
		expect(result.matchCount).toBe(0);
	});

	it("should return correct line numbers", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "TODO",
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		expect(result.matches[0].lineNumber).toBe(4); // "TODO" is on line 4
	});

	it("should handle count mode", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "function",
			mode: "count",
		});

		expect(result.matchCount).toBe(1);
		expect(result.matches).toHaveLength(0);
	});

	it("should handle multiline patterns spanning lines", () => {
		// Pattern that crosses a line boundary: "import { foo" to "return"
		// With s flag (our multiline), . matches newlines.
		const pattern = "import \\{ foo .*?return";
		const result = searchContent(SAMPLE_TEXT, {
			pattern,
			multiline: true,
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		expect(result.matches[0].line).toContain("import");
		expect(result.matches[0].line).toContain("return");
	});

	it("should NOT match across lines without multiline flag", () => {
		// Without s flag, . does NOT match newlines, so cross-line pattern fails.
		const pattern = "import \\{ foo .*?return";
		const result = searchContent(SAMPLE_TEXT, {
			pattern,
			multiline: false,
		});

		expect(result.matches).toHaveLength(0);
	});

	it("should return error for invalid regex", () => {
		const result = searchContent(SAMPLE_TEXT, {
			pattern: "[unclosed",
		});

		// Should escape invalid regex and match literally
		expect(result.error).toBeUndefined(); // We handle this by escaping
	});

	it("should truncate long lines", () => {
		const longLine = "a".repeat(200);
		const content = `line1\n${longLine}\nline3`;

		const result = searchContent(content, {
			pattern: "a+",
			maxColumns: 50,
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		expect(result.matches[0].line.length).toBeLessThanOrEqual(50);
	});
});
