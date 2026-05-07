import { spawn } from "node:child_process";
import { SemgrepError } from "./shared/errors";

// ── Types ──────────────────────────────────────────────────────────

/** Severity levels semgrep can report. */
export type SemgrepSeverity = "ERROR" | "WARNING" | "INFO" | "INVENTORY";

/** A single finding from a semgrep scan. */
export interface SemgrepMatch {
	/** Rule or check id that triggered (e.g. "eqeq-is-bad", "python.lang.security.audit.eval-detected"). */
	checkId: string;
	/** File path where the match occurred. */
	path: string;
	/** 1-indexed start line. */
	startLine: number;
	/** 1-indexed start column. */
	startCol: number;
	/** 1-indexed end line. */
	endLine: number;
	/** 1-indexed end column. */
	endCol: number;
	/** The matched code lines. */
	lines: string;
	/** Human-readable message describing the finding. */
	message: string;
	/** Severity of the finding. */
	severity: SemgrepSeverity;
	/** Rule metadata (optional, from rule definition). */
	metadata?: Record<string, unknown>;
}

export interface SemgrepResult {
	/** All matches found. */
	matches: SemgrepMatch[];
	/** Number of files scanned. */
	filesScanned: number;
	/** Number of files skipped. */
	filesSkipped: number;
	/** Number of matches (total). */
	totalMatches: number;
	/** Scan errors, if any. */
	errors: Array<{ message: string; path?: string }>;
}

export interface SemgrepOptions {
	/** Semgrep pattern expression (e.g. "eval(...)", "$X == $X"). */
	pattern?: string;
	/** Rule config: "auto", rule pack (e.g. "p/default", "p/r2c-security-audit"), or path to rule file. */
	config?: string;
	/** Path to file or directory to scan. Defaults to cwd. */
	path: string;
	/** Target language (e.g. "ts", "py", "java", "go"). Required when using a pattern. */
	language?: string;
	/** Filter results by minimum severity. */
	severity?: SemgrepSeverity;
	/** Working directory for relative paths. */
	cwd?: string;
	/** Timeout in milliseconds. */
	timeoutMs?: number;
}

// ── Semgrep CLI wrapper ───────────────────────────────────────────

/**
 * Run semgrep scan and return structured results.
 *
 * If `pattern` is provided, uses `semgrep -e <pattern>` for AST-aware
 * pattern matching. Otherwise uses `--config <config>` for rule-based scanning.
 */
export async function semgrepScan(options: SemgrepOptions): Promise<SemgrepResult> {
	const {
		pattern,
		config,
		path: scanPath,
		language,
		severity,
		cwd,
		timeoutMs,
	} = options;

	// Build args
	const args: string[] = ["scan", "--json", "--no-rewrite-rule-ids", "--quiet"];

	if (pattern) {
		args.push("-e", pattern);
		if (language) {
			args.push("--lang", language);
		}
	} else if (config) {
		args.push("--config", config);
	} else {
		// Default to auto
		args.push("--config", "auto");
	}

	if (severity) {
		args.push("--severity", severity);
	}

	args.push("--", scanPath);

	// Spawn semgrep
	const proc = spawn("semgrep", args, {
		stdio: ["ignore", "pipe", "pipe"],
		cwd,
	});

	// Collect output
	const stdoutChunks: Buffer[] = [];
	const stderrChunks: Buffer[] = [];

	return new Promise<SemgrepResult>((resolve, reject) => {
		let settled = false;
		const timer = timeoutMs ? setTimeout(() => {
			if (!settled) {
				settled = true;
				proc.kill();
				reject(new SemgrepError("Semgrep scan timed out"));
			}
		}, timeoutMs) : null;

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
			reject(new SemgrepError(`Failed to spawn semgrep: ${err.message}. Is semgrep installed?`));
		});

		proc.on("close", (code: number | null) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);

			const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
			const stderr = Buffer.concat(stderrChunks).toString("utf-8");

			// Check for common environment issues that result in non-0/1 exit codes
			const isPermissionError = stderr.includes("PermissionError") || stderr.includes("Operation not permitted");
			const isConfigError = stderr.includes("configuration") || stderr.includes("config");

			if (code !== 0 && code !== 1) {
				// Code 1 means matches found (semgrep convention). Code 0 = no matches.
				// Any other code is an actual error.
				let errMsg = stderr.trim() || `semgrep exited with code ${code}`;
				
				// Provide helpful context for common issues
				if (isPermissionError) {
					errMsg += "\n\nThis appears to be a permission issue with semgrep's log directory. Try running: mkdir -p ~/.semgrep && chmod 755 ~/.semgrep";
				} else if (isConfigError) {
					errMsg += "\n\nThis appears to be a semgrep configuration issue. Check your semgrep installation and config files.";
				}
				
				reject(new SemgrepError(errMsg));
				return;
			}

			try {
				resolve(parseSemgrepOutput(stdout));
			} catch (err) {
				// Include stderr in parse errors for better debugging
				const baseMsg = err instanceof Error ? err.message : String(err);
				const stderrSuffix = stderr.trim() ? ` Stderr: ${stderr.trim()}` : "";
				
				// Special handling for empty output with permission errors
				if (stdout.trim() === "" && isPermissionError) {
					reject(new SemgrepError(
						"Semgrep failed to run due to permission issues. " +
						"This may be caused by semgrep not being able to write to its log directory. " +
						`${stderrSuffix}`
					));
				} else {
					reject(
						new SemgrepError(
							`Failed to parse semgrep output: ${baseMsg}${stderrSuffix}`,
						),
					);
				}
			}
		});
	});
}

// ── JSON Output Parser ────────────────────────────────────────────

interface RawSemgrepOutput {
	results?: Array<{
		check_id: string;
		path: string;
		start: { line: number; col: number; offset: number };
		end: { line: number; col: number; offset: number };
		extra: {
			lines: string;
			message: string;
			severity: SemgrepSeverity;
			metadata?: Record<string, unknown>;
			fingerprint?: string;
			is_ignored?: boolean;
			engine_kind?: string;
			metavars?: Record<string, unknown>;
			validation_state?: string;
		};
	}>;
	paths?: {
		scanned?: string[];
		skipped?: Array<{ path: string; reason: string }>;
	};
	errors?: Array<{
		type?: string;
		message?: string;
		path?: string;
		rule_id?: string;
	}>;
}

function parseSemgrepOutput(stdout: string): SemgrepResult {
	// Check if stdout is empty or whitespace only
	const trimmedOutput = stdout.trim();
	if (!trimmedOutput) {
		throw new Error("Semgrep output is empty - no JSON data to parse");
	}

	// Try to parse JSON with better error context
	let raw: RawSemgrepOutput;
	try {
		raw = JSON.parse(trimmedOutput);
	} catch (err) {
		// Include first 200 chars of output in error message for debugging
		const preview = trimmedOutput.slice(0, 200);
		const isComplete = trimmedOutput.length <= 200;
		throw new Error(`Failed to parse JSON output from semgrep. ${err instanceof Error ? err.message : String(err)}. Output${isComplete ? '' : ' (truncated)'}: "${preview}"`);
	}

	const matches: SemgrepMatch[] = (raw.results ?? [])
		.filter(r => !r.extra?.is_ignored)
		.map(r => ({
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
	const filesSkipped = raw.paths?.skipped?.length ?? 0;

	const errors: Array<{ message: string; path?: string }> = (raw.errors ?? [])
		.filter(e => e.type !== "OK")
		.map(e => ({
			message: e.message ?? e.type ?? "Unknown error",
			path: e.path,
		}));

	return {
		matches,
		filesScanned,
		filesSkipped,
		totalMatches: matches.length,
		errors,
	};
}

// ── Convenience functions ─────────────────────────────────────────

/**
 * Build a human-readable report from semgrep matches.
 */
export function formatSemgrepResults(result: SemgrepResult, cwd: string): string {
	const lines: string[] = [];

	if (result.matches.length === 0 && result.errors.length === 0) {
		return "(no matches found)";
	}

	// Group matches by file
	const byFile = new Map<string, SemgrepMatch[]>();
	for (const match of result.matches) {
		const arr = byFile.get(match.path) ?? [];
		arr.push(match);
		byFile.set(match.path, arr);
	}

	for (const [filePath, fileMatches] of byFile) {
		const relPath = cwd ? pathRelative(filePath, cwd) : filePath;
		lines.push(`\n${relPath} (${fileMatches.length} match${fileMatches.length !== 1 ? "es" : ""}):`);
		for (const m of fileMatches) {
			lines.push(`  ${m.severity} ${m.checkId}`);
			lines.push(`    ${m.message}`);
			lines.push(`    at line ${m.startLine}:${m.startCol}`);
			if (m.lines) {
				lines.push(`    \`${m.lines.replace(/\n/g, "\\n").slice(0, 120)}\``);
			}
		}
	}

	if (result.errors.length > 0) {
		lines.push("\nScan errors:");
		for (const err of result.errors) {
			lines.push(`  ${err.path ? `[${err.path}] ` : ""}${err.message}`);
		}
	}

	return lines.join("\n");
}

function pathRelative(filePath: string, cwd: string): string {
	if (filePath.startsWith(cwd)) {
		return filePath.slice(cwd.length + 1);
	}
	return filePath;
}

// ── Error type ─────────────────────────────────────────────────────

export { SemgrepError };
