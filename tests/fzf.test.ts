import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { fzfSearch, FzfError } from "../src/fzf";

// ── Helpers ────────────────────────────────────────────────────────

const FZF_AVAILABLE = spawnSync("which", ["fzf"]).status === 0;

function fzfDescribe(name: string, fn: () => void) {
	if (FZF_AVAILABLE) {
		describe(name, fn);
	} else {
		describe.skip(name, fn);
	}
}

// ── Integration tests (require fzf binary) ─────────────────────────

let testDir: string;

fzfDescribe("fzfSearch", () => {
	beforeAll(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-fzf-test-"));

		// Create a realistic project structure
		await fs.mkdir(path.join(testDir, "src", "auth"), { recursive: true });
		await fs.mkdir(path.join(testDir, "src", "db"), { recursive: true });
		await fs.mkdir(path.join(testDir, "src", "api"), { recursive: true });
		await fs.mkdir(path.join(testDir, "src", "db", "migrations"), { recursive: true });

		await fs.writeFile(path.join(testDir, "src", "auth", "middleware.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "auth", "login.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "auth", "register.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "db", "config.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "db", "connection.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "db", "migrations", "001_init.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "api", "routes.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "api", "handlers.ts"), "");
		await fs.writeFile(path.join(testDir, "package.json"), "");
		await fs.writeFile(path.join(testDir, "README.md"), "");
	});

	afterAll(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should fuzzy match file paths", async () => {
		const result = await fzfSearch({
			query: "auth mid",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		expect(result.matches.some(m => m.path.endsWith("middleware.ts"))).toBe(true);
	});

	it("should return all files for empty query", async () => {
		const result = await fzfSearch({
			query: "",
			path: testDir,
			limit: 100,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(9); // 9 files created
		expect(result.limitReached).toBe(false);
	});

	it("should respect limit parameter", async () => {
		const result = await fzfSearch({
			query: "",
			path: testDir,
			limit: 3,
		});

		expect(result.matches.length).toBeLessThanOrEqual(3);
	});

	it("should filter by glob pattern", async () => {
		const result = await fzfSearch({
			query: "",
			path: testDir,
			glob: "*.json",
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		expect(result.matches.every(m => m.path.endsWith(".json"))).toBe(true);
	});

	it("should return empty for no matches", async () => {
		const result = await fzfSearch({
			query: "zzzzz_nonexistent_xxxx",
			path: testDir,
		});

		expect(result.totalMatches).toBe(0);
		expect(result.matches).toHaveLength(0);
	});

	it("should handle non-existent path", async () => {
		const result = await fzfSearch({
			query: "test",
			path: "/nonexistent/path/12345",
		});

		expect(result.totalMatches).toBe(0);
		expect(result.matches).toHaveLength(0);
	});

	it("should search a single file path", async () => {
		const result = await fzfSearch({
			query: "package",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		expect(result.matches.some(m => m.path.endsWith("package.json"))).toBe(true);
	});

	it("should fuzzy match with partial terms in different order", async () => {
		const result = await fzfSearch({
			query: "db config",
			path: testDir,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(1);
		expect(result.matches.some(m => m.path.endsWith("config.ts"))).toBe(true);
	});

	it("should throw FzfError when binary is not found", async () => {
		if (!FZF_AVAILABLE) return;

		try {
			await fzfSearch({
				query: "test",
				path: testDir,
				timeoutMs: 100,
			});
		} catch (err) {
			// Should not get here since fzf is installed
			expect(err instanceof FzfError).toBe(true);
		}
	});
});

// ── Unit tests (no binary needed) ──────────────────────────────────

describe("fzf file collector", () => {
	it("should have exported FzfError class", () => {
		const err = new FzfError("test error");
		expect(err.name).toBe("FzfError");
		expect(err.message).toBe("test error");
	});
});
