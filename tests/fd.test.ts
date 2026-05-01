import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { fdFind, FdError } from "../src/fd";

// ── Helpers ────────────────────────────────────────────────────────

const FD_AVAILABLE = spawnSync("which", ["fd"]).status === 0;

function fdDescribe(name: string, fn: () => void) {
	if (FD_AVAILABLE) {
		describe(name, fn);
	} else {
		describe.skip(name, fn);
	}
}

// ── Integration tests (require fd binary) ─────────────────────────

let testDir: string;

fdDescribe("fdFind", () => {
	beforeAll(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-fd-test-"));

		await fs.mkdir(path.join(testDir, "src", "auth"), { recursive: true });
		await fs.mkdir(path.join(testDir, "src", "db"), { recursive: true });
		await fs.mkdir(path.join(testDir, "src", "api"), { recursive: true });
		await fs.mkdir(path.join(testDir, "node_modules"), { recursive: true });
		await fs.mkdir(path.join(testDir, ".hidden_dir"), { recursive: true });

		await fs.writeFile(path.join(testDir, "src", "auth", "middleware.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "auth", "login.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "db", "config.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "db", "connection.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "api", "routes.ts"), "");
		await fs.writeFile(path.join(testDir, "src", "api", "handlers.ts"), "");
		await fs.writeFile(path.join(testDir, "package.json"), "");
		await fs.writeFile(path.join(testDir, "README.md"), "");
		await fs.writeFile(path.join(testDir, ".hidden_dir", "secret.txt"), "");
		await fs.writeFile(path.join(testDir, "node_modules", "dep.js"), "");
	});

	afterAll(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should find all files in a directory", async () => {
		const result = await fdFind({
			path: testDir,
		});

		// Should find all files except hidden, node_modules, .git
		expect(result.totalMatches).toBeGreaterThanOrEqual(8);
	});

	it("should find files matching a regex pattern", async () => {
		const result = await fdFind({
			pattern: "middleware|login",
			path: testDir,
		});

		expect(result.totalMatches).toBe(2);
		const paths = result.matches.map(m => m.path);
		expect(paths.some(p => p.endsWith("middleware.ts"))).toBe(true);
		expect(paths.some(p => p.endsWith("login.ts"))).toBe(true);
	});

	it("should filter by extension", async () => {
		const result = await fdFind({
			path: testDir,
			extension: "ts",
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(6);
		expect(result.matches.every(m => m.path.endsWith(".ts"))).toBe(true);
	});

	it("should filter by glob pattern", async () => {
		const result = await fdFind({
			path: testDir,
			glob: "*.json",
		});

		expect(result.totalMatches).toBe(1);
		expect(result.matches[0].path.endsWith("package.json")).toBe(true);
	});

	it("should find directories with type filter", async () => {
		const result = await fdFind({
			path: testDir,
			type: "directory",
			// Max results to avoid timeout on large dirs
			maxResults: 10,
		});

		expect(result.totalMatches).toBeGreaterThanOrEqual(4);
	});

	it("should respect maxResults", async () => {
		const result = await fdFind({
			path: testDir,
			maxResults: 3,
		});

		expect(result.matches.length).toBeLessThanOrEqual(3);
	});

	it("should include hidden files when hidden=true", async () => {
		const result = await fdFind({
			path: testDir,
			hidden: true,
		});

		// Should find .hidden_dir/secret.txt
		expect(result.matches.some(m => m.path.includes(".hidden_dir"))).toBe(true);
	});

	it("should exclude hidden files by default", async () => {
		const result = await fdFind({
			path: testDir,
		});

		// Should NOT find .hidden_dir/secret.txt
		expect(result.matches.every(m => !m.path.includes(".hidden_dir"))).toBe(true);
	});

	it("should include gitignored files with noIgnore", async () => {
		const result = await fdFind({
			path: testDir,
			noIgnore: true,
		});

		// Should find node_modules/dep.js
		expect(result.matches.some(m => m.path.includes("node_modules"))).toBe(true);
	});

	it("should return empty for no matches", async () => {
		const result = await fdFind({
			pattern: "zzzzz_nonexistent_xxxxx",
			path: testDir,
		});

		expect(result.totalMatches).toBe(0);
		expect(result.matches).toHaveLength(0);
	});

	it("should handle non-existent path", async () => {
		try {
			await fdFind({
				pattern: "test",
				path: "/nonexistent/path/12345",
			});
		} catch (err) {
			expect(err instanceof FdError).toBe(true);
		}
	});
});

// ── Unit tests ─────────────────────────────────────────────────────

describe("fd unit tests", () => {
	it("should have exported FdError class", () => {
		const err = new FdError("test error");
		expect(err.name).toBe("FdError");
		expect(err.message).toBe("test error");
	});
});
