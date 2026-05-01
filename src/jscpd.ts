/**
 * jscpd CLI wrapper — copy/paste detection for finding duplicated code.
 *
 * jscpd (JavaScript Copy/Paste Detector) finds exact and near-duplicate
 * code blocks across a codebase. Supports 150+ languages and multiple
 * detection modes (strict, mild, weak).
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { JscpdError } from "./shared/errors";

// ── Types ───────────────────────────────────────────────────────────

export interface JscpdDuplicateLocation {
	name: string;
	start: number;
	end: number;
}

export interface JscpdDuplicate {
	/** Language format of the duplicated code. */
	format: string;
	/** Number of duplicated lines. */
	lines: number;
	/** The duplicated code fragment. */
	fragment: string;
	/** First occurrence. */
	firstFile: JscpdDuplicateLocation;
	/** Second occurrence. */
	secondFile: JscpdDuplicateLocation;
}

export interface JscpdResult {
	/** All duplicate pairs found. */
	duplicates: JscpdDuplicate[];
	/** Total number of clone pairs. */
	totalClones: number;
	/** Total duplicated lines across all clones. */
	totalDuplicatedLines: number;
	/** Percentage of duplicated lines in the codebase. */
	percentage: number;
	/** Number of source files analyzed. */
	totalSources: number;
	/** Total lines analyzed. */
	totalLines: number;
}

export interface JscpdOptions {
	/** Paths to files or directories to scan. */
	paths: string[];
	/** Minimum lines for a duplication to be reported (default: 5). */
	minLines?: number;
	/** Minimum tokens (default: 50). */
	minTokens?: number;
	/** Detection mode: "strict" (exact), "mild" (near-dup), "weak" (loose). */
	mode?: "strict" | "mild" | "weak";
	/** Glob patterns to ignore, e.g. test files, node_modules, dist dirs. */
	ignore?: string[];
	/** Filter by language format (e.g., ["typescript", "python"]). */
	format?: string[];
	/** Working directory for relative paths. */
	cwd?: string;
}

// ── JSON output types ──────────────────────────────────────────────

interface JscpdJsonSource {
	lines: number;
	tokens: number;
	sources: number;
	clones: number;
	duplicatedLines: number;
	duplicatedTokens: number;
	percentage: number;
	percentageTokens: number;
}

interface JscpdJsonStats {
	formats: Record<string, {
		sources: Record<string, JscpdJsonSource>;
		total: JscpdJsonSource;
	}>;
	total: JscpdJsonSource;
}

interface JscpdJsonDuplicate {
	format: string;
	lines: number;
	fragment: string;
	tokens: number;
	firstFile: {
		name: string;
		start: number;
		end: number;
	};
	secondFile: {
		name: string;
		start: number;
		end: number;
	};
}

interface JscpdJsonReport {
	statistics: JscpdJsonStats;
	duplicates: JscpdJsonDuplicate[];
}

// ── Main jscpd function ───────────────────────────────────────────

export async function jscpdDetect(options: JscpdOptions): Promise<JscpdResult> {
	const {
		paths: scanPaths,
		minLines = 5,
		minTokens = 50,
		mode = "strict",
		ignore,
		format,
		cwd,
	} = options;

	// Create a temp directory for the JSON report
	const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-sherlock-jscpd-"));

	try {
		const args: string[] = [
			"--reporters", "json",
			"--silent",
			"--min-lines", String(minLines),
			"--min-tokens", String(minTokens),
			"--mode", mode,
			"--output", outputDir,
		];

		if (ignore && ignore.length > 0) {
			for (const pattern of ignore) {
				args.push("--ignore", pattern);
			}
		}

		if (format && format.length > 0) {
			args.push("--format", format.join(","));
		}

		args.push(...scanPaths);

		const proc = spawn("jscpd", args, {
			stdio: ["ignore", "pipe", "pipe"],
			cwd,
		});

		const result = await new Promise<JscpdResult>((resolve, reject) => {
			let settled = false;
			const stderrChunks: Buffer[] = [];

			proc.stderr.on("data", (chunk: Buffer) => {
				stderrChunks.push(chunk);
			});

			proc.on("error", (err: Error) => {
				if (settled) return;
				settled = true;
				reject(new JscpdError(`Failed to spawn jscpd: ${err.message}. Is jscpd installed? (npm i -g jscpd)`));
			});

			proc.on("close", async (code: number | null) => {
				if (settled) return;
				settled = true;

				if (code !== 0) {
					const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
					reject(new JscpdError(stderr || `jscpd exited with code ${code}`));
					return;
				}

				try {
					const reportPath = path.join(outputDir, "jscpd-report.json");
					let jsonContent: string;
					try {
						jsonContent = await fs.readFile(reportPath, "utf-8");
					} catch {
						// jscpd may not write a report when all files are ignored/excluded
						resolve({
							duplicates: [],
							totalClones: 0,
							totalDuplicatedLines: 0,
							percentage: 0,
							totalSources: 0,
							totalLines: 0,
						});
						return;
					}
					const raw = JSON.parse(jsonContent) as JscpdJsonReport;

					const duplicates: JscpdDuplicate[] = (raw.duplicates ?? []).map(d => ({
						format: d.format,
						lines: d.lines,
						fragment: d.fragment ?? "",
						firstFile: { name: d.firstFile.name, start: d.firstFile.start, end: d.firstFile.end },
						secondFile: { name: d.secondFile.name, start: d.secondFile.start, end: d.secondFile.end },
					}));

					resolve({
						duplicates,
						totalClones: raw.statistics.total.clones,
						totalDuplicatedLines: raw.statistics.total.duplicatedLines,
						percentage: raw.statistics.total.percentage,
						totalSources: raw.statistics.total.sources,
						totalLines: raw.statistics.total.lines,
					});
				} catch (parseErr) {
					reject(new JscpdError(
						`Failed to parse jscpd report: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
					));
				}
			});
		});

		return result;
	} finally {
		// Clean up temp directory
		await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
	}
}

// ── Formatter ──────────────────────────────────────────────────────

/**
 * Format jscpd results into a human-readable report.
 */
export function formatJscpdResults(result: JscpdResult, cwd: string): string {
	if (result.duplicates.length === 0) {
		return "(no duplicated code found)";
	}

	const lines: string[] = [];

	// Summary header
	lines.push(
		`Found ${result.totalClones} clone${result.totalClones !== 1 ? "s" : ""} ` +
		`with ${result.totalDuplicatedLines} duplicated lines ` +
		`(${result.percentage.toFixed(1)}% of ${result.totalLines} total lines across ${result.totalSources} files)\n`,
	);

	// Show each duplicate pair
	for (let i = 0; i < result.duplicates.length; i++) {
		const dup = result.duplicates[i];
		const firstRel = resolveRelative(dup.firstFile.name, cwd);
		const secondRel = resolveRelative(dup.secondFile.name, cwd);

		lines.push(`${"─".repeat(72)}`);
		lines.push(`Clone #${i + 1}: ${dup.lines} duplicated lines in ${dup.format}`);
		lines.push(`  File A: ${firstRel} (lines ${dup.firstFile.start}–${dup.firstFile.end})`);
		lines.push(`  File B: ${secondRel} (lines ${dup.secondFile.start}–${dup.secondFile.end})`);

		// Show a snippet of the duplicated code (first 10 lines)
		const snippet = dup.fragment.split("\n").slice(0, 10);
		lines.push("  ```");
		for (const snippetLine of snippet) {
			lines.push(`  ${snippetLine}`);
		}
		if (dup.fragment.split("\n").length > 10) {
			lines.push(`  … (${dup.fragment.split("\n").length - 10} more lines)`);
		}
		lines.push("  ```\n");
	}

	return lines.join("\n");
}

/**
 * Resolve a jscpd path (which may have ../../.. prefixes) to something readable.
 */
function resolveRelative(filePath: string, cwd: string): string {
	// jscpd sometimes uses relative paths with "../.." prefixes from the output dir
	// Try to resolve against cwd, fall back to the raw path
	try {
		if (filePath.startsWith("/")) return filePath;
		// Strip leading "../../.." noise from jscpd if present
		const cleaned = filePath.replace(/^(\.\.\/)+/, "");
		return cleaned || filePath;
	} catch {
		return filePath;
	}
}

// ── Error type ──────────────────────────────────────────────────────

export { JscpdError };
