import { spawn } from "node:child_process";
import { FdError } from "./shared/errors";

// ── Types ──────────────────────────────────────────────────────────

export type FdFileType = "file" | "directory" | "symlink";

export interface FdMatch {
	/** File path (relative to search root or absolute, depending on how fd was invoked). */
	path: string;
}

export interface FdResult {
	/** Matched file/directory paths. */
	matches: FdMatch[];
	/** Number of results returned. */
	totalMatches: number;
	/** Whether the result was truncated by limit. */
	limitReached: boolean;
}

export interface FdOptions {
	/** Regex pattern for filename matching. */
	pattern?: string;
	/** Directory to search. */
	path: string;
	/** Glob pattern (e.g. "*.ts"). */
	glob?: string;
	/** File extension (e.g. "ts", "py"). */
	extension?: string;
	/** File type filter: "file", "directory", or "symlink". */
	type?: FdFileType;
	/** Include hidden files and directories. */
	hidden?: boolean;
	/** Do not respect .gitignore. */
	noIgnore?: boolean;
	/** Maximum number of results to return. */
	maxResults?: number;
	/** Case-sensitive search. */
	caseSensitive?: boolean;
	/** Working directory for relative paths. */
	cwd?: string;
	/** Timeout in milliseconds. */
	timeoutMs?: number;
}

// ── Main fd function ─────────────────────────────────────────────

/**
 * Fast file finding using the `fd` command.
 */
export async function fdFind(options: FdOptions): Promise<FdResult> {
	const {
		pattern,
		path: searchPath,
		glob,
		extension,
		type,
		hidden,
		noIgnore,
		maxResults,
		caseSensitive,
		cwd,
		timeoutMs,
	} = options;

	// Build args
	const args: string[] = [];

	// File type
	if (type) {
		args.push("--type", type);
	} else {
		// Default to files only
		args.push("--type", "file");
	}

	// Glob pattern
	if (glob) {
		args.push("--glob", glob);
	}

	// Extension filter
	if (extension) {
		args.push("--extension", extension);
	}

	// Hidden files
	if (hidden) {
		args.push("--hidden");
	}

	// No ignore
	if (noIgnore) {
		args.push("--no-ignore");
	}

	// Case sensitivity (fd is case-insensitive by default)
	if (caseSensitive) {
		args.push("--case-sensitive");
	}

	// Max results
	if (maxResults !== undefined && maxResults > 0) {
		args.push("--max-results", String(maxResults));
	}

	// Pattern — fd requires a pattern before the path. Use "." as match-all when none given.
	// When glob is specified, the glob already acts as the filter, so we omit the pattern
	// to avoid fd treating "." as an additional search path.
	if (glob) {
		// No pattern needed — glob is the filter
	} else if (pattern) {
		args.push(pattern);
	} else {
		args.push(".");
	}

	// Search path
	args.push("--", searchPath);

	// Spawn fd
	const proc = spawn("fd", args, {
		stdio: ["ignore", "pipe", "pipe"],
		cwd,
	});

	// Normalize by stripping the search root prefix so paths are always relative
	const searchPrefix = searchPath.endsWith("/") ? searchPath : searchPath + "/";

	return new Promise<FdResult>((resolve, reject) => {
		let settled = false;
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		const timer = timeoutMs
			? setTimeout(() => {
					if (!settled) {
						settled = true;
						proc.kill();
						reject(new FdError("fd search timed out"));
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
			reject(new FdError(`Failed to spawn fd: ${err.message}. Is fd installed?`));
		});

		proc.on("close", (code: number | null) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);

			if (code !== 0) {
				const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
				// Exit code 1 with no output = no matches (not an error)
				if (code === 1 && stdoutChunks.length === 0) {
					resolve({ matches: [], totalMatches: 0, limitReached: false });
					return;
				}
				reject(new FdError(stderr || `fd exited with code ${code}`));
				return;
			}

			const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
			const lines = stdout
				.split("\n")
				.map(l => l.trim())
				.filter(l => l.length > 0);

			// Normalize paths: strip the search root prefix if paths are absolute
			const normalized = lines.map(l => {
				if (l.startsWith(searchPrefix)) {
					return l.slice(searchPrefix.length);
				}
				return l;
			});

			// Detect if limit was hit by checking if fd exited normally with --max-results
			// fd exits with code 0 even when max-results is reached, so we can't use exit code.
			// We estimate limitReached based on maxResults
			const limitReached = maxResults !== undefined && normalized.length >= maxResults;

			resolve({
				matches: normalized.map(l => ({ path: l })),
				totalMatches: normalized.length,
				limitReached,
			});
		});
	});
}

// ── Error type ────────────────────────────────────────────────────

export { FdError };
