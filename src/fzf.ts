import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FzfError } from "./shared/errors";
import { collectFilePaths } from "./shared/fs";

// ── Types ──────────────────────────────────────────────────────────

export interface FzfMatch {
	/** File path (relative to search root). */
	path: string;
}

export interface FzfResult {
	/** Matched file paths. */
	matches: FzfMatch[];
	/** Total number of files searched. */
	totalFiles: number;
	/** Number of results returned. */
	totalMatches: number;
	/** Whether the result was truncated by limit. */
	limitReached: boolean;
}

export interface FzfOptions {
	/** Fuzzy search query. */
	query: string;
	/** Directory or file to search. */
	path: string;
	/** Glob pattern to filter file types (e.g. "*.ts"). */
	glob?: string;
	/** Maximum number of results to return. */
	limit?: number;
	/** Working directory for relative paths. */
	cwd?: string;
	/** Timeout in milliseconds. */
	timeoutMs?: number;
}

// ── File collector (re-exports shared impl) ────────────────────────

export { collectFilePaths };

// ── Glob matching ─────────────────────────────────────────────────

/**
 * Simple glob pattern matching for filenames.
 * Supports: *, **, ? and basic character classes.
 */
function matchesGlob(filePath: string, pattern: string): boolean {
	// Convert glob pattern to regex
	const regexStr = pattern
		.replace(/\./g, "\\.")
		.replace(/\*\*/g, "___DOUBLESTAR___")
		.replace(/\*/g, "[^/]*")
		.replace(/___DOUBLESTAR___/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(`^${regexStr}$`).test(filePath);
}

// ── Main fzf function ────────────────────────────────────────────

/**
 * Run fuzzy file path search using fzf's non-interactive filter mode.
 *
 * Collects file paths from a directory, then pipes them through
 * `fzf --filter=<query>` for fuzzy matching.
 */
export async function fzfSearch(options: FzfOptions): Promise<FzfResult> {
	const { query, path: searchPath, glob, limit = 20, cwd, timeoutMs } = options;

	// Resolve search path
	const resolvedPath = path.resolve(cwd ?? process.cwd(), searchPath);

	// Collect file paths
	const stat = await fs.stat(resolvedPath).catch(() => null);
	if (!stat) {
		return { matches: [], totalFiles: 0, totalMatches: 0, limitReached: false };
	}

	const rootDir = stat.isDirectory() ? resolvedPath : path.dirname(resolvedPath);

	let allFiles: string[];
	if (stat.isDirectory()) {
		allFiles = await collectFilePaths(resolvedPath, rootDir);
	} else if (stat.isFile()) {
		allFiles = [path.relative(rootDir, resolvedPath)];
	} else {
		return { matches: [], totalFiles: 0, totalMatches: 0, limitReached: false };
	}

	if (allFiles.length === 0) {
		return { matches: [], totalFiles: 0, totalMatches: 0, limitReached: false };
	}

	// Apply glob filter
	let filteredFiles = allFiles;
	if (glob) {
		filteredFiles = allFiles.filter(f => matchesGlob(f, glob));
	}

	if (filteredFiles.length === 0) {
		return { matches: [], totalFiles: allFiles.length, totalMatches: 0, limitReached: false };
	}

	// Empty query returns all files (up to limit)
	if (!query || query.trim().length === 0) {
		const sliced = filteredFiles.slice(0, limit);
		return {
			matches: sliced.map(f => ({ path: f })),
			totalFiles: allFiles.length,
			totalMatches: sliced.length,
			limitReached: filteredFiles.length > limit,
		};
	}

	// Pipe files through fzf --filter
	const result = await pipeThroughFzf(filteredFiles, query, cwd, timeoutMs);
	const matched = result.matches.slice(0, limit);

	return {
		matches: matched,
		totalFiles: allFiles.length,
		totalMatches: result.total,
		limitReached: result.total > limit,
	};
}

// ── fzf process runner ───────────────────────────────────────────

interface FzfProcessResult {
	matches: FzfMatch[];
	total: number;
}

async function pipeThroughFzf(
	files: string[],
	query: string,
	cwd?: string,
	timeoutMs?: number,
): Promise<FzfProcessResult> {
	return new Promise<FzfProcessResult>((resolve, reject) => {
		let settled = false;

		// Spawn fzf with --filter mode
		const proc = spawn("fzf", ["--filter", query], {
			stdio: ["pipe", "pipe", "pipe"],
			cwd,
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		const timer = timeoutMs
			? setTimeout(() => {
					if (!settled) {
						settled = true;
						proc.kill();
						reject(new FzfError("fzf search timed out"));
					}
			  }, timeoutMs)
			: null;

		proc.stdout.on("data", (chunk: Buffer) => {
			stdoutChunks.push(chunk);
		});

		proc.stderr.on("data", (chunk: Buffer) => {
			stderrChunks.push(chunk);
		});

		proc.on("error", (err: Error) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			reject(new FzfError(`Failed to spawn fzf: ${err.message}. Is fzf installed?`));
		});

		proc.on("close", (code: number | null) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);

			if (code !== 0) {
				const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
				// Exit code 1 with no output = no matches (not an error)
				if (code === 1 && stdoutChunks.length === 0) {
					resolve({ matches: [], total: 0 });
					return;
				}
				reject(new FzfError(stderr || `fzf exited with code ${code}`));
				return;
			}

			const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
			const lines = stdout
				.split("\n")
				.map(l => l.trim())
				.filter(l => l.length > 0);

			resolve({
				matches: lines.map(l => ({ path: l })),
				total: lines.length,
			});
		});

		// Write files to stdin and close
		const input = files.join("\n");
		proc.stdin.write(input);
		proc.stdin.end();
	});
}

// ── Error type ────────────────────────────────────────────────────

export { FzfError };
