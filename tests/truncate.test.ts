/**
 * Tests for output size validation and truncation.
 */
import { describe, it, expect } from "bun:test";
import {
	truncateOutput,
	withOutputTruncation,
	DEFAULT_MAX_CHARS,
	DEFAULT_MAX_LINES,
} from "../src/shared/truncate";

// ── truncateOutput ─────────────────────────────────────────────────

describe("truncateOutput", () => {
	it("returns empty text unchanged", () => {
		const result = truncateOutput("");
		expect(result.text).toBe("");
		expect(result.truncated).toBe(false);
	});

	it("returns short text unchanged", () => {
		const text = "hello world";
		const result = truncateOutput(text, 100, 10);
		expect(result.text).toBe(text);
		expect(result.truncated).toBe(false);
		expect(result.originalLength).toBe(11);
		expect(result.originalLines).toBe(1);
	});

	it("truncates long text by characters", () => {
		const text = "a".repeat(500);
		const result = truncateOutput(text, 100);
		expect(result.truncated).toBe(true);
		expect(result.text.length).toBeLessThan(text.length);
		expect(result.text).toContain("(truncated:");
		expect(result.text).toContain("chars");
		expect(result.text).not.toContain("lines");
		expect(result.originalLength).toBe(500);
	});

	it("truncates long text by lines first", () => {
		const text = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n");
		const result = truncateOutput(text, 10_000, 10);
		expect(result.truncated).toBe(true);
		expect(result.text).toContain("(truncated:");
		expect(result.text).toContain("lines");
		expect(result.originalLines).toBe(50);
		// Should have first 10 lines plus the truncation note line
		const lines = result.text.split("\n");
		expect(lines.filter(l => l.startsWith("line ")).length).toBe(10);
	});

	it("applies both line and char truncation when both exceeded", () => {
		// 5 lines, each 300 chars = 1500 chars total
		const lines = Array.from({ length: 5 }, (_, i) => `x`.repeat(300));
		const text = lines.join("\n");
		const result = truncateOutput(text, 100, 3);
		expect(result.truncated).toBe(true);
		expect(result.text).toContain("(truncated:");
		expect(result.text).toContain("lines");
		expect(result.text).toContain("chars");
	});

	it("leaves text alone when within both thresholds", () => {
		const text = "a".repeat(100) + "\n" + "b".repeat(100);
		const result = truncateOutput(text, 500, 10);
		expect(result.truncated).toBe(false);
		expect(result.text).toBe(text);
	});

	it("handles null/undefined gracefully", () => {
		const result = truncateOutput(null as unknown as string);
		expect(result.text).toBe("");
		expect(result.truncated).toBe(false);
	});
});

// ── withOutputTruncation ───────────────────────────────────────────

describe("withOutputTruncation", () => {
	it("passes through untruncated results unchanged", () => {
		const result = withOutputTruncation(
			{ text: "short result", details: { result: "short result", query: "test" } },
			10_000,
			200,
		);
		expect(result.text).toBe("short result");
		expect(result.details.result).toBe("short result");
	});

	it("truncates long results and updates details.result", () => {
		const longText = "a".repeat(500);
		const result = withOutputTruncation(
			{ text: longText, details: { result: longText, query: "test", matchCount: 100, fileCount: 5 } },
			100,
		);
		expect(result.text).not.toBe(longText);
		expect(result.text).toContain("(truncated:");
		expect(result.details.result).toBe(result.text); // details.result updated to match
		// Other detail fields preserved
		expect(result.details.query).toBe("test");
		expect(result.details.matchCount).toBe(100);
		expect(result.details.fileCount).toBe(5);
	});

	it("works with details that have no result field", () => {
		const longText = "x".repeat(200);
		const result = withOutputTruncation(
			{ text: longText, details: { query: "test" } },
			100,
		);
		expect(result.text).toContain("(truncated:");
		// details.result was never set, so details remain untouched
		expect((result.details as any).result).toBeUndefined();
	});
});
