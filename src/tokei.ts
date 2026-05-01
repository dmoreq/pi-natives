/**
 * tokei CLI wrapper — fast code line counter.
 *
 * tokei counts lines of code, comments, and blanks across languages.
 * It's like `cloc` but faster (written in Rust) and respects .gitignore.
 */
import { spawn } from "node:child_process";
import { TokeiError } from "./shared/errors";

// ── Types ───────────────────────────────────────────────────────────

export interface TokeiLanguageStats {
	/** Total blank lines. */
	blanks: number;
	/** Total lines of code. */
	code: number;
	/** Total comment lines. */
	comments: number;
	/** Total lines (blanks + code + comments). */
	lines: number;
	/** Per-file breakdown (when --files is used). */
	files: Array<{
		name: string;
		blanks: number;
		code: number;
		comments: number;
	}>;
	/** Whether counts might be inaccurate (e.g., from unknown extensions). */
	inaccurate: boolean;
}

export interface TokeiResult {
	/** Language → stats. Includes "Total" key. */
	languages: Record<string, TokeiLanguageStats>;
	/** Total across all languages. */
	total: TokeiLanguageStats;
}

export interface TokeiOptions {
	/** Paths to files or directories to count. */
	paths: string[];
	/** Include per-file statistics. */
	files?: boolean;
	/** Exclude files/directories matching these patterns. */
	exclude?: string[];
	/** Include hidden files. */
	hidden?: boolean;
	/** Don't respect ignore files. */
	noIgnore?: boolean;
	/** Filter by language types (e.g., ["Rust", "TypeScript"]). */
	types?: string[];
	/** Sort by column: "files", "lines", "blanks", "code", or "comments". */
	sort?: "files" | "lines" | "blanks" | "code" | "comments";
	/** Reverse sort. */
	reverseSort?: boolean;
	/** Working directory for relative paths. */
	cwd?: string;
}

// ── JSON output types ──────────────────────────────────────────────

interface TokeiJsonReport {
	stats: {
		blanks: number;
		code: number;
		comments: number;
		blobs: Record<string, never>;
	};
	name: string;
}

interface TokeiJsonLanguage {
	blanks: number;
	code: number;
	comments: number;
	reports: TokeiJsonReport[];
	children: Record<string, unknown>;
	inaccurate: boolean;
}

interface TokeiJsonOutput {
	[language: string]: TokeiJsonLanguage;
}

// ── Main tokei function ───────────────────────────────────────────

export async function tokeiCount(options: TokeiOptions): Promise<TokeiResult> {
	const {
		paths,
		files,
		exclude,
		hidden,
		noIgnore,
		types,
		sort,
		reverseSort,
		cwd,
	} = options;

	// Build args
	const args: string[] = ["--output", "json"];

	if (files) {
		args.push("--files");
	}

	if (hidden) {
		args.push("--hidden");
	}

	if (noIgnore) {
		args.push("--no-ignore");
	}

	if (exclude) {
		for (const e of exclude) {
			args.push("--exclude", e);
		}
	}

	if (types && types.length > 0) {
		args.push("--types", types.join(","));
	}

	if (sort) {
		args.push("--sort", sort);
	}

	if (reverseSort) {
		args.push("--rsort", sort ?? "code");
	}

	args.push(...paths);

	// Spawn tokei
	const proc = spawn("tokei", args, {
		stdio: ["ignore", "pipe", "pipe"],
		cwd,
	});

	return new Promise<TokeiResult>((resolve, reject) => {
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
			reject(new TokeiError(`Failed to spawn tokei: ${err.message}. Is tokei installed?`));
		});

		proc.on("close", (code: number | null) => {
			if (settled) return;
			settled = true;

			const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
			const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();

			if (code !== 0) {
				reject(new TokeiError(stderr || `tokei exited with code ${code}`));
				return;
			}

			try {
				const raw = JSON.parse(stdout) as TokeiJsonOutput;
				resolve(parseTokeiJson(raw));
			} catch (parseErr) {
				reject(new TokeiError(
					`Failed to parse tokei output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
				));
			}
		});
	});
}

// ── JSON parser ──────────────────────────────────────────────────

function parseTokeiJson(raw: TokeiJsonOutput): TokeiResult {
	const languages: Record<string, TokeiLanguageStats> = {};

	for (const [lang, data] of Object.entries(raw)) {
		const filesList = (data.reports ?? []).map(r => ({
			name: r.name,
			blanks: r.stats.blanks,
			code: r.stats.code,
			comments: r.stats.comments,
		}));

		languages[lang] = {
			blanks: data.blanks,
			code: data.code,
			comments: data.comments,
			lines: data.blanks + data.code + data.comments,
			files: filesList,
			inaccurate: data.inaccurate,
		};
	}

	const totalData = raw["Total"] ?? { blanks: 0, code: 0, comments: 0, reports: [], inaccurate: false };

	const total: TokeiLanguageStats = {
		blanks: (totalData as TokeiJsonLanguage).blanks ?? 0,
		code: (totalData as TokeiJsonLanguage).code ?? 0,
		comments: (totalData as TokeiJsonLanguage).comments ?? 0,
		lines: ((totalData as TokeiJsonLanguage).blanks ?? 0) + ((totalData as TokeiJsonLanguage).code ?? 0) + ((totalData as TokeiJsonLanguage).comments ?? 0),
		files: [],
		inaccurate: (totalData as TokeiJsonLanguage).inaccurate ?? false,
	};

	return { languages, total };
}

// ── Formatter ─────────────────────────────────────────────────────

/**
 * Format tokei results into a human-readable table.
 */
export function formatTokeiResults(result: TokeiResult): string {
	const { languages, total } = result;

	// Filter out "Total" from the language list
	const langEntries = Object.entries(languages).filter(([k]) => k !== "Total");

	if (langEntries.length === 0) {
		return "(no code found)";
	}

	// Build a simple table
	const lines: string[] = [];
	lines.push("Language          Files     Lines      Code  Comments    Blanks");
	lines.push("───────────────  ──────  ────────  ────────  ────────  ────────");

	for (const [lang, stats] of langEntries) {
		const name = lang.length > 15 ? lang.slice(0, 14) + "…" : lang.padEnd(15);
		const fileCount = String(stats.files.length || 0).padStart(6);
		const lineCount = String(stats.lines).padStart(8);
		const codeCount = String(stats.code).padStart(8);
		const commentCount = String(stats.comments).padStart(8);
		const blankCount = String(stats.blanks).padStart(8);
		lines.push(`${name}  ${fileCount}  ${lineCount}  ${codeCount}  ${commentCount}  ${blankCount}`);
	}

	lines.push("───────────────  ──────  ────────  ────────  ────────  ────────");
	const totalName = "Total".padEnd(15);
	const totalFiles = String(langEntries.reduce((sum, [, s]) => sum + s.files.length, 0)).padStart(6);
	const totalLines = String(total.lines).padStart(8);
	const totalCode = String(total.code).padStart(8);
	const totalComments = String(total.comments).padStart(8);
	const totalBlanks = String(total.blanks).padStart(8);
	lines.push(`${totalName}  ${totalFiles}  ${totalLines}  ${totalCode}  ${totalComments}  ${totalBlanks}`);

	return lines.join("\n");
}

// ── Error type ──────────────────────────────────────────────────────

export { TokeiError };
