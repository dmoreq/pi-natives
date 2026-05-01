import { spawn } from "node:child_process";
import { GrepError } from "./shared/errors";
import { stripTrailingNewline, truncateLine } from "./shared/utils";

// ── Types ───────────────────────────────────────────────────────────

export type GrepOutputMode = "content" | "count" | "filesWithMatches";

export interface GrepOptions {
	/** Regex pattern to search for. */
	pattern: string;
	/** Directory or file to search. */
	path: string;
	/** Glob filter for filenames (e.g., "*.ts"). */
	glob?: string;
	/** Filter by file type alias (e.g., "js", "py", "rust"). */
	type?: string;
	/** Case-insensitive search. */
	ignoreCase?: boolean;
	/** Enable multiline matching. */
	multiline?: boolean;
	/** Include hidden files (default: true). */
	hidden?: boolean;
	/** Respect .gitignore files (default: true). */
	gitignore?: boolean;
	/** Maximum number of matches to return. */
	maxCount?: number;
	/** Skip first N matches. */
	offset?: number;
	/** Lines of context before matches. */
	contextBefore?: number;
	/** Lines of context after matches. */
	contextAfter?: number;
	/** Lines of context before/after matches (legacy). */
	context?: number;
	/** Truncate lines longer than this (characters). */
	maxColumns?: number;
	/** Output mode. */
	mode?: GrepOutputMode;
	/** Timeout in milliseconds. */
	timeoutMs?: number;
	/** Working directory for relative paths. */
	cwd?: string;
}

export interface ContextLine {
	/** 1-indexed line number. */
	lineNumber: number;
	/** The context line content. */
	line: string;
}

export interface GrepMatch {
	/** File path for the match (relative when searching a directory). */
	path: string;
	/** 1-indexed line number (0 for count-only entries). */
	lineNumber: number;
	/** The matched line content (empty for count-only entries). */
	line: string;
	/** Context lines before the match. */
	contextBefore?: ContextLine[];
	/** Context lines after the match. */
	contextAfter?: ContextLine[];
	/** Whether the line was truncated. */
	truncated?: boolean;
	/** Per-file match count (count mode only). */
	matchCount?: number;
}

export interface GrepResult {
	/** Matches or per-file counts, depending on output mode. */
	matches: GrepMatch[];
	/** Total matches across all files. */
	totalMatches: number;
	/** Number of files with at least one match. */
	filesWithMatches: number;
	/** Number of files searched. */
	filesSearched: number;
	/** Whether the limit/offset stopped the search early. */
	limitReached?: boolean;
}

// ── rg JSON line types ─────────────────────────────────────────────

interface RgBeginData {
	path: { text: string };
}

interface RgMatchData {
	path: { text: string };
	lines: { text: string };
	line_number: number;
	absolute_offset: number;
	submatches: Array<{ start: number; end: number; match: { text: string } }>;
}

interface RgContextData {
	path: { text: string };
	lines: { text: string };
	line_number: number;
	absolute_offset: number;
}

interface RgEndData {
	path: { text: string };
	stats?: { matches: number };
}

interface RgSummaryData {
	elapsed_total: { secs: number; nanos: number; human: string };
	stats: {
		matched_lines: number;
		matches: number;
		searched_lines: number;
		searches: number;
		searches_with_match: number;
		bytes_printed: number;
		bytes_searched: number;
		elapsed: { secs: number; nanos: number; human: string };
	};
}

type RgLine =
	| { type: "begin"; data: RgBeginData }
	| { type: "match"; data: RgMatchData }
	| { type: "context"; data: RgContextData }
	| { type: "end"; data: RgEndData }
	| { type: "summary"; data: RgSummaryData };

// ── Internal state machine per file ────────────────────────────────

interface FileState {
	path: string;
	contextBefore: ContextLine[];
	matchCount: number;
}

// ── Main grep function ─────────────────────────────────────────────

export async function grep(options: GrepOptions): Promise<GrepResult> {
	const {
		pattern,
		path: searchPath,
		glob,
		type: fileType,
		ignoreCase,
		multiline,
		hidden = true,
		gitignore = true,
		maxCount,
		offset,
		contextBefore: ctxBefore,
		contextAfter: ctxAfter,
		context: ctxLegacy,
		maxColumns,
		mode = "content",
		timeoutMs,
		cwd,
	} = options;

	if (!pattern) {
		return emptyResult();
	}

	// Resolve context before/after
	const contextBefore = ctxBefore ?? ctxLegacy ?? 0;
	const contextAfter = ctxAfter ?? ctxLegacy ?? 0;

	// Build rg args
	const args: string[] = ["--json", "--color", "never", "--no-heading"];

	// Case sensitivity
	if (ignoreCase) {
		args.push("-i");
	}

	// Multiline
	if (multiline) {
		args.push("-U");
	}

	// Hidden files
	if (hidden) {
		args.push("--hidden");
	} else {
		args.push("--no-hidden");
	}

	// .gitignore
	if (gitignore) {
		args.push("--no-ignore-global"); // only respect project .gitignore
	} else {
		args.push("--no-ignore");
	}

	// Binary detection — skip binary files
	args.push("--no-unicode");
	args.push("-M", "100000"); // max column length to avoid memory issues

	// Glob filter
	if (glob) {
		args.push("-g", glob);
	}

	// File type filter
	if (fileType) {
		args.push("--type", fileType);
	}

	// Max count per file (rg uses -m for per-file limit)
	// We use a generous per-file limit; global limit is enforced in post-processing
	if (maxCount !== undefined) {
		args.push("-m", String(Math.min(maxCount, 10000)));
	}

	// Context lines
	if (contextBefore > 0) {
		args.push("-B", String(contextBefore));
	}
	if (contextAfter > 0) {
		args.push("-A", String(contextAfter));
	}

	// Pattern
	args.push("--", pattern, searchPath);

	// Spawn rg using Node.js child_process
	const proc = spawn("rg", args, {
		stdio: ["ignore", "pipe", "pipe"],
		cwd,
	});

	// Collect output
	const stdoutChunks: Uint8Array[] = [];
	let stderrText = "";

	proc.stdout.on("data", (chunk: Uint8Array) => {
		stdoutChunks.push(chunk);
	});
	proc.stderr.on("data", (chunk: Uint8Array) => {
		stderrText += chunk.toString();
	});

	const exitCode: number = await new Promise((resolve, reject) => {
		proc.on("close", resolve);
		proc.on("error", reject);
	});

	if (exitCode === 2) {
		// rg exit code 2 = error
		throw new GrepError(`rg failed: ${stderrText.trim()}`);
	}

	// rg exit code 0 = matches found, 1 = no matches
	const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
	if (exitCode === 1 || stdout.trim().length === 0) {
		return emptyResult();
	}

	// Parse JSON lines
	return parseRgOutput(stdout, { mode, maxColumns, offset, maxCount, contextBefore, contextAfter });
}

// ── Parse rg --json output ─────────────────────────────────────────

function parseRgOutput(
	stdout: string,
	opts: {
		mode: GrepOutputMode;
		maxColumns?: number;
		offset?: number;
		maxCount?: number;
		contextBefore: number;
		contextAfter: number;
	},
): GrepResult {
	const { mode, maxColumns, offset: skipCount = 0, maxCount } = opts;

	const matches: GrepMatch[] = [];
	const seenFiles = new Set<string>();
	let filesWithMatches = 0;
	let filesSearched = 0;
	let totalMatchCount = 0;
	let skipped = 0;
	let limitReached = false;
	let currentFile = "";

	if (mode === "count") {
		return parseCountMode(stdout);
	}

	if (mode === "filesWithMatches") {
		return parseFilesWithMatchesMode(stdout);
	}

	// Content mode: parse match + context lines
	let fileState: FileState | null = null;

	const lines = stdout.trim().split("\n");
	for (const rawLine of lines) {
		if (!rawLine.trim()) continue;

		let rgLine: RgLine;
		try {
			rgLine = JSON.parse(rawLine) as RgLine;
		} catch {
			continue;
		}

		switch (rgLine.type) {
			case "begin": {
				currentFile = rgLine.data.path.text;
				seenFiles.add(currentFile);
				filesSearched++;
				fileState = {
					path: currentFile,
					contextBefore: [],
					matchCount: 0,
				};
				break;
			}

			case "match": {
				const { data } = rgLine;
				const filePath = data.path.text;
				const lineContent = stripTrailingNewline(data.lines.text);

				if (fileState && fileState.path !== filePath) {
					fileState = {
						path: filePath,
						contextBefore: [],
						matchCount: 0,
					};
				}

				totalMatchCount++;

				// Handle skip (offset)
				if (skipCount > 0 && totalMatchCount <= skipCount) {
					if (fileState) {
						fileState.contextBefore = [];
						fileState.matchCount++;
					}
					continue;
				}

				// Handle maxCount (global limit)
				if (maxCount !== undefined && matches.length >= maxCount) {
					limitReached = true;
					continue;
				}

				if (fileState) {
					fileState.matchCount++;
				}

				const match: GrepMatch = {
					path: filePath,
					lineNumber: data.line_number,
					line: maxColumns !== undefined ? truncateLine(lineContent, maxColumns) : lineContent,
					contextBefore: fileState ? [...fileState.contextBefore] : [],
					contextAfter: [],
					truncated: maxColumns !== undefined && lineContent.length > maxColumns,
				};

				matches.push(match);
				// Reset context before after emitting a match
				if (fileState) {
					fileState.contextBefore = [];
				}
				break;
			}

			case "context": {
				const { data } = rgLine;
				const filePath = data.path.text;
				const lineContent = stripTrailingNewline(data.lines.text);

				if (fileState && fileState.path === filePath) {
					const ctxLine: ContextLine = {
						lineNumber: data.line_number,
						line: maxColumns !== undefined ? truncateLine(lineContent, maxColumns) : lineContent,
					};

					// Add to contextBefore of upcoming match, or contextAfter of last match
					if (matches.length > 0 && matches[matches.length - 1].path === filePath) {
						const lastMatch = matches[matches.length - 1];
						if (lastMatch.contextAfter) {
							lastMatch.contextAfter.push(ctxLine);
						}
					} else {
						fileState.contextBefore.push(ctxLine);
					}
				}
				break;
			}

			case "end": {
				const { data } = rgLine;
				if (data.stats && data.stats.matches > 0) {
					filesWithMatches++;
				}
				fileState = null;
				break;
			}

			case "summary": {
				// Already handled via begin/end
				break;
			}
		}
	}

	return {
		matches,
		totalMatches: totalMatchCount,
		filesWithMatches,
		filesSearched,
		limitReached,
	};
}

function parseCountMode(stdout: string): GrepResult {
	const matches: GrepMatch[] = [];
	let totalMatches = 0;
	let filesWithMatches = 0;
	let filesSearched = 0;

	// rg --count-only --json
	const lines = stdout.trim().split("\n");
	for (const rawLine of lines) {
		if (!rawLine.trim()) continue;

		let rgLine: RgLine;
		try {
			rgLine = JSON.parse(rawLine) as RgLine;
		} catch {
			continue;
		}

		if (rgLine.type === "begin") {
			filesSearched++;
		} else if (rgLine.type === "end") {
			const count = rgLine.data.stats?.matches ?? 0;
			if (count > 0) {
				filesWithMatches++;
				matches.push({
					path: rgLine.data.path.text,
					lineNumber: 0,
					line: "",
					matchCount: count,
				});
			}
			totalMatches += count;
		}
	}

	return { matches, totalMatches, filesWithMatches, filesSearched };
}

function parseFilesWithMatchesMode(stdout: string): GrepResult {
	const seenPaths = new Set<string>();
	const matches: GrepMatch[] = [];
	let filesSearched = 0;

	const lines = stdout.trim().split("\n");
	for (const rawLine of lines) {
		if (!rawLine.trim()) continue;

		let rgLine: RgLine;
		try {
			rgLine = JSON.parse(rawLine) as RgLine;
		} catch {
			continue;
		}

		if (rgLine.type === "begin") {
			filesSearched++;
		} else if (rgLine.type === "end" && rgLine.data.stats && rgLine.data.stats.matches > 0) {
			const filePath = rgLine.data.path.text;
			if (!seenPaths.has(filePath)) {
				seenPaths.add(filePath);
				matches.push({
					path: filePath,
					lineNumber: 0,
					line: "",
				});
			}
		}
	}

	return {
		matches,
		totalMatches: matches.length,
		filesWithMatches: matches.length,
		filesSearched,
	};
}

// ── Helpers ─────────────────────────────────────────────────────────

function emptyResult(): GrepResult {
	return { matches: [], totalMatches: 0, filesWithMatches: 0, filesSearched: 0 };
}

export { GrepError };
