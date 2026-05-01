import { describe, expect, it } from "bun:test";
import { Bm25Index } from "../src/bm25";

describe("Bm25Index", () => {
	it("should return empty results for empty index", () => {
		const index = new Bm25Index();
		const results = index.search("test");
		expect(results).toHaveLength(0);
	});

	it("should find exact match documents", () => {
		const index = new Bm25Index();
		index.addDocuments([
			{ id: "doc1", text: "the quick brown fox jumps over the lazy dog" },
			{ id: "doc2", text: "the lazy dog sleeps all day" },
			{ id: "doc3", text: "python javascript typescript programming language" },
		]);

		const results = index.search("fox");
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0].id).toBe("doc1");
		expect(results[0].score).toBeGreaterThan(0);
	});

	it("should rank by relevance (term frequency)", () => {
		const index = new Bm25Index();
		index.addDocuments([
			{ id: "frequent", text: "authentication authentication authentication is important" },
			{ id: "single", text: "authentication is a security concern" },
		]);

		const results = index.search("authentication");
		expect(results.length).toBe(2);
		expect(results[0].id).toBe("frequent"); // higher tf → higher score
		expect(results[0].score).toBeGreaterThan(results[1].score);
	});

	it("should handle multi-word queries", () => {
		const index = new Bm25Index();
		index.addDocuments([
			{ id: "auth1", text: "authentication middleware for express applications" },
			{ id: "db1", text: "database configuration with postgres and sequelize" },
			{ id: "auth2", text: "jwt token authentication and authorization flow" },
		]);

		const results = index.search("authentication middleware");
		expect(results.length).toBeGreaterThanOrEqual(1);
		// auth1 should rank highest (mentions both "authentication" and "middleware")
		expect(results[0].id).toBe("auth1");
	});

	it("should respect topK parameter", () => {
		const index = new Bm25Index();
		index.addDocuments([
			{ id: "a", text: "apple banana cherry date" },
			{ id: "b", text: "banana cherry date" },
			{ id: "c", text: "cherry date" },
			{ id: "d", text: "date" },
		]);

		const results = index.search("apple banana", 2);
		expect(results.length).toBeLessThanOrEqual(2);
	});

	it("should handle add/remove/replace", () => {
		const index = new Bm25Index();
		index.addDocument({ id: "doc1", text: "authentication system" });
		index.addDocument({ id: "doc2", text: "database system" });

		let results = index.search("authentication");
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("doc1");

		// Replace doc1
		index.addDocument({ id: "doc1", text: "database authentication system" });
		results = index.search("database");
		expect(results.length).toBeGreaterThanOrEqual(1);
	});

	it("should return scores rounded to 6 decimal places", () => {
		const index = new Bm25Index();
		index.addDocument({ id: "doc1", text: "the quick brown fox" });

		const results = index.search("fox");
		expect(results.length).toBe(1);
		// Score should be a finite number rounded to 6 decimal places
		const scoreStr = results[0].score.toString();
		const decimalPart = scoreStr.split(".")[1] || "";
		expect(decimalPart.length).toBeLessThanOrEqual(6);
	});

	it("should be empty after clear", () => {
		const index = new Bm25Index();
		index.addDocument({ id: "doc1", text: "test content" });
		expect(index.documentCount).toBe(1);

		index.clear();
		expect(index.documentCount).toBe(0);

		const results = index.search("test");
		expect(results).toHaveLength(0);
	});

	it("should handle documents with short tokens (filtered)", () => {
		const index = new Bm25Index();
		index.addDocuments([
			{ id: "doc1", text: "a b c d e f g h i j k l m n o p" }, // single chars filtered
			{ id: "doc2", text: "important meaningful content here" },
		]);

		// Single-char tokens are filtered out, so doc1 should be empty
		const results = index.search("meaningful");
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("doc2");
	});

	it("should handle custom k1 and b parameters", () => {
		const index = new Bm25Index(2.0, 0.5);
		index.addDocuments([
			{ id: "short", text: "authentication" },
			{ id: "long", text: "authentication " + "padding ".repeat(50) },
		]);

		const results = index.search("authentication");
		expect(results).toHaveLength(2);
		// Both should have scores since both contain the query term
		expect(results[0].score).toBeGreaterThan(0);
		expect(results[1].score).toBeGreaterThan(0);
	});
});
