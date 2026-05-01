/**
 * ast-grep CLI wrapper — structural search & refactoring via AST patterns.
 *
 * ast-grep understands code as AST nodes (not just text), enabling precise
 * structural matching, metavariable capture, and code rewriting.
 *
 * Unlike semgrep (which targets security/linting rules), ast-grep is designed
 * for structural search and automated refactoring with a programmable API.
 */
import { spawn } from "node:child_process";
import { AstGrepError } from "./shared/errors";

// ── Types ───────────────────────────────────────────────────────────

export interface AstGrepMatch {
	/** The matched code text. */
	text: string;
	/** File path where the match occurred. */
	file: string;
	/** The full line(s) containing the match. */
	lines: string;
	/** Detected language. */
	language: string;
	/** 0-indexed line number. */
	line: number;
	/** 0-indexed column number. */
	column: number;
	/** Byte offset of the match. */
	byteStart: number;
	byteEnd: number;
	/** Captured metavariables: single ($X) and multi ($$$X). */
	metaVariables: {
		single: Record<string, { text: string; line: number; column: number }>;
		multi: Record<string, Array<{ text: string; line: number; column: number }>>;
	};
}

export interface AstGrepResult {
	/** All matches found. */
	matches: AstGrepMatch[];
	/** Total number of matches. */
	totalMatches: number;
	/** Number of files scanned (estimated). */
	filesScanned: number;
	/** Warnings from stderr (e.g., invalid patterns that still ran). */
	warnings: string[];
}

export interface AstGrepOptions {
	/** AST pattern to match (e.g. "eval($$$A)", "$O.method($$$ARGS)"). */
	pattern: string;
	/** Target language (e.g. "ts", "py", "rs", "go"). */
	language?: string;
	/** Path to file or directory to search. */
	path: string;
	/** Optional rewrite string (replaces matched nodes). */
	rewrite?: string;
	/** Strictness level for pattern matching. */
	strictness?: "cst" | "smart" | "ast" | "relaxed" | "signature" | "template";
	/** Follow symbolic links. */
	follow?: boolean;
	/** Working directory for relative paths. */
	cwd?: string;
}

// ── Main ast-grep function ────────────────────────────────────────

export async function astGrepSearch(options: AstGrepOptions): Promise<AstGrepResult> {
	const {
		pattern,
		language,
		path: searchPath,
		rewrite,
		strictness,
		follow,
		cwd,
	} = options;

	// Build args
	const args: string[] = ["run", "--json"];

	args.push("-p", pattern);

	if (language) {
		args.push("-l", language);
	}

	if (rewrite) {
		args.push("-r", rewrite);
	}

	if (strictness) {
		args.push("--strictness", strictness);
	}

	if (follow) {
		args.push("--follow");
	}

	args.push(searchPath);

	// Spawn ast-grep
	const proc = spawn("ast-grep", args, {
		stdio: ["ignore", "pipe", "pipe"],
		cwd,
	});

	return new Promise<AstGrepResult>((resolve, reject) => {
		let settled = false;
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		proc.stdout.on("data", (chunk: Buffer) => {
			stdoutChunks.push(chunk);
		});

		proc.stderr.on("data", (chunk: Buffer) => {
			stderrChunks.push(chunk);
		});

		proc.on("error", (err: Error) => {
			if (settled) return;
			settled = true;
			reject(new AstGrepError(`Failed to spawn ast-grep: ${err.message}. Is ast-grep installed?`));
		});

		proc.on("close", (code: number | null) => {
			if (settled) return;
			settled = true;

			const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
			const stderr = Buffer.concat(stderrChunks).toString("utf-8");

			// Collect warnings from stderr
			const warnings = stderr
				.split("\n")
				.map(l => l.trim())
				.filter(l => l.length > 0);

			// Check for real errors (stderr containing "ERROR:" or missing file)
			const hasError = warnings.some(w => w.startsWith("ERROR:") || w.includes("No such file"));

			if (hasError) {
				reject(new AstGrepError(stderr.trim()));
				return;
			}

			// Code 1 = no matches (not an error)
			// Code 0 = matches found (or valid but empty pattern)
			try {
				const rawMatches = JSON.parse(stdout || "[]") as any[];
				const matches: AstGrepMatch[] = rawMatches.map(m => ({
					text: m.text ?? "",
					file: m.file ?? "",
					lines: m.lines ?? "",
					language: m.language ?? "",
					line: m.range?.start?.line ?? 0,
					column: m.range?.start?.column ?? 0,
					byteStart: m.range?.byteOffset?.start ?? 0,
					byteEnd: m.range?.byteOffset?.end ?? 0,
					metaVariables: {
						single: m.metaVariables?.single ?? {},
						multi: m.metaVariables?.multi ?? {},
					},
				}));

				// Count unique files scanned
				const uniqueFiles = new Set(matches.map(m => m.file));

				resolve({
					matches,
					totalMatches: matches.length,
					filesScanned: uniqueFiles.size,
					warnings: warnings.filter(w => !w.startsWith("ERROR:")),
				});
			} catch (parseErr) {
				reject(new AstGrepError(
					`Failed to parse ast-grep output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
				));
			}
		});
	});
}

// ── Formatter ──────────────────────────────────────────────────────

import * as path from "node:path";

/**
 * Format ast-grep results into a human-readable report.
 */
export function formatAstGrepResults(result: AstGrepResult, cwd: string): string {
	if (result.matches.length === 0) {
		const lines: string[] = ["(no structural matches found)"];
		if (result.warnings.length > 0) {
			lines.push("\nWarnings:");
			for (const w of result.warnings) {
				lines.push(`  ${w}`);
			}
		}
		return lines.join("\n");
	}

	// Group matches by file
	const byFile = new Map<string, AstGrepMatch[]>();
	for (const match of result.matches) {
		const arr = byFile.get(match.file) ?? [];
		arr.push(match);
		byFile.set(match.file, arr);
	}

	const lines: string[] = [];
	for (const [filePath, fileMatches] of byFile) {
		const relPath = cwd ? path.relative(cwd, filePath) : filePath;
		lines.push(`\n${relPath} (${fileMatches.length} match${fileMatches.length !== 1 ? "es" : ""}):`);
		for (const m of fileMatches) {
			const metaVars = [
				...Object.entries(m.metaVariables.single).map(([k, v]) => `$${k}=${v.text}`),
				...Object.entries(m.metaVariables.multi).map(([k, vals]) => `$$$${k}=[${vals.map(v => v.text).join(", ")}]`),
			];
			const metaStr = metaVars.length > 0 ? ` (${metaVars.join(", ")})` : "";
			lines.push(`  line ${m.line + 1}:${m.column + 1}: \`${m.text.slice(0, 120)}${m.text.length > 120 ? "…" : ""}\`${metaStr}`);
		}
	}

	if (result.warnings.length > 0) {
		lines.push("\nWarnings:");
		for (const w of result.warnings) {
			lines.push(`  ${w}`);
		}
	}

	return lines.join("\n");
}

// ── Error type ──────────────────────────────────────────────────────

export { AstGrepError };
