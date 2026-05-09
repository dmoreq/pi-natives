/**
 * AST-aware edits via ast-grep `--rewrite`, with literal fallback for non-code files
 * or when ast-grep is unavailable. Applies changes atomically via {@link BunFileWriter}.
 */
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

import { BunFileWriter, restoreFromBackup } from "./bun-writer.ts";
import { AstEditError } from "./shared/errors.ts";
import { checkBinary } from "./shared/cli.ts";
import {
	FileTypeDetector,
	astGrepLanguageForFile,
	type DetectionResult,
} from "./read-router.ts";

// ── Public types ────────────────────────────────────────────────────

export interface AstEditOptions {
	path: string;
	pattern: string;
	replacement: string;
	preview?: boolean;
	/** When absent, defaults to true for writes and false during preview-only runs. */
	backup?: boolean;
	nodeType?: "function" | "class" | "method" | "variable" | "generic";
	/**
	 * Only **`file`** (default when omitted) is implemented: patterns run across the whole file.
	 *
	 * **`function`** and **`class`** remain **reserved** for future nested-scope rewrites — they behave like **`file`** today, and callers receive {@link AstEditResult.warnings} noting that limitation.
	 */
	scope?: "file" | "function" | "class";
	cwd?: string;
}

export interface AstChange {
	/** Matched range start line (0-based, editor-style). */
	line?: number;
	column?: number;
	/** Source text before rewrite. */
	before?: string;
	/** Replacement text ast-grep would apply. */
	after?: string;
}

export interface AstEditResult {
	changes: AstChange[];
	totalChanges: number;
	previewDiff?: string;
	backupPath?: string;
	editTime: number;
	method: "ast-grep" | "native-string";
	syntaxValid: boolean;
	/** Observability helpers (e.g. reserved-parameter notices). */
	warnings?: string[];
}

/** Subprocess result from one `ast-grep run` invocation. */
export type AstGrepSpawnResult = {
	code: number | null;
	stdout: string;
	stderr: string;
};

export interface AstGrepSpawnOpts {
	pattern: string;
	replacement: string;
	lang?: string;
	strictness?: string;
	target: string;
	cwd: string;
	jsonCompact: boolean;
	updateAll: boolean;
}

/** Low-level ast-grep invocation hook (see {@link AstFileEditorOptions.grepSpawn}). */
export type AstGrepSpawnFn = (cmd: string, opts: AstGrepSpawnOpts) => Promise<AstGrepSpawnResult>;

export interface AstFileEditorOptions {
	detector?: FileTypeDetector;
	writer?: BunFileWriter;
	/**
	 * Override ast-grep binary resolution: explicit command name/path, or `null` to force native-string for experiments/tests.
	 */
	astGrepCommand?: string | null;
	/**
	 * Test/determinism seam: replaces the default `child_process.spawn` pipeline.
	 * Keeps CI green without a real `ast-grep` install while still exercising match scan, preview, and apply logic.
	 */
	grepSpawn?: AstGrepSpawnFn;
}

/** Map structural edit intent to ast-grep pattern strictness. */
export function strictnessForNodeType(
	nodeType: AstEditOptions["nodeType"],
): string | undefined {
	switch (nodeType) {
		case "generic":
			return "smart";
		case "function":
		case "method":
		case "class":
			return "ast";
		default:
			return undefined;
	}
}

/**
 * Normalize user-supplied AST pattern; reserved for richer node-kind wrapping later.
 * Today `nodeType` mainly informs {@link strictnessForNodeType}.
 */
export function buildRewritePattern(
	pattern: string,
	nodeType: AstEditOptions["nodeType"],
): string {
	if (!pattern.trim()) {
		throw new AstEditError("Rewrite pattern must be non-empty");
	}
	if (!nodeType || nodeType === "generic") {
		return pattern;
	}
	return pattern;
}

/**
 * Explain how {@link AstEditOptions.scope} is interpreted today (only `file` is effective).
 *
 * **`function`** and **`class`** are accepted for schema stability but deliberately perform whole-file rewriting until relational rules ship.
 */
export function scopeReservationWarnings(scope: AstEditOptions["scope"] | undefined): string[] {
	if (scope === "function" || scope === "class") {
		return [
			`scope "${scope}" is reserved — patterns still apply to the entire file until nested-scope rewriting is implemented (use AST patterns or split files manually).`,
		];
	}
	return [];
}

function attachWarnings<T extends AstEditResult>(result: T, extra: string[]): T {
	if (extra.length === 0) return result;
	return {
		...result,
		warnings: [...(result.warnings ?? []), ...extra],
	};
}

// ── AstFileEditor ─────────────────────────────────────────────────

export class AstFileEditor {
	private readonly detector: FileTypeDetector;
	private readonly writer: BunFileWriter;
	private readonly astGrepOverride: string | null | undefined;
	private readonly grepSpawn: AstGrepSpawnFn;

	constructor(options?: AstFileEditorOptions) {
		this.detector = options?.detector ?? new FileTypeDetector();
		this.writer = options?.writer ?? new BunFileWriter();
		this.astGrepOverride = options?.astGrepCommand;
		this.grepSpawn = options?.grepSpawn ?? spawnAstGrep;
	}

	static restore(backupPath: string, targetPath: string): Promise<void> {
		return restoreFromBackup(backupPath, targetPath);
	}

	async edit(options: AstEditOptions): Promise<AstEditResult> {
		const t0 = performance.now();
		const preview = options.preview ?? false;
		const backupOpt = options.backup ?? (!preview ? true : false);

		const cwd = options.cwd ?? process.cwd();
		const absRaw = options.path.trim()
			? path.isAbsolute(options.path)
				? path.normalize(options.path)
				: path.resolve(cwd, options.path)
			: "";
		if (!absRaw) {
			throw new AstEditError("edit path must be non-empty");
		}
		buildRewritePattern(options.pattern, options.nodeType);

		const scopeMsgs = scopeReservationWarnings(options.scope);

		if (!existsSync(absRaw)) {
			throw new AstEditError(`File not found: ${absRaw}`);
		}

		const detection = this.detector.detect(absRaw);
		const useAst =
			detection.fileType === "code" && this.resolveAstGrepCommand() !== null;

		if (useAst) {
			return attachWarnings(
				await this.editWithAstGrep(options, absRaw, detection, preview, backupOpt, t0),
				scopeMsgs,
			);
		}
		return attachWarnings(
			await this.editWithNativeString(options, absRaw, detection, preview, backupOpt, t0),
			scopeMsgs,
		);
	}

	private resolveAstGrepCommand(): string | null {
		if (this.astGrepOverride === null) {
			return null;
		}
		if (typeof this.astGrepOverride === "string" && this.astGrepOverride.length > 0) {
			return this.astGrepOverride;
		}
		return checkBinary("sg") ?? checkBinary("ast-grep");
	}

	private async editWithNativeString(
		options: AstEditOptions,
		absPath: string,
		detection: DetectionResult,
		preview: boolean,
		backup: boolean,
		t0: number,
	): Promise<AstEditResult> {
		const before = await fs.readFile(absPath, "utf8");
		const count = countLiteralOccurrences(before, options.pattern);
		const after = replaceAllLiteral(before, options.pattern, options.replacement);
		const previewDiff = formatNativePreview(path.basename(absPath), before, after);

		if (preview) {
			return {
				changes: syntheticNativeChanges(count),
				totalChanges: count,
				previewDiff,
				editTime: performance.now() - t0,
				method: "native-string",
				syntaxValid: true,
			};
		}

		if (count === 0) {
			return {
				changes: [],
				totalChanges: 0,
				editTime: performance.now() - t0,
				method: "native-string",
				syntaxValid: await validateSyntax(absPath, detection),
			};
		}

		let backupPath: string | undefined;
		const write = await this.writer.write({
			path: absPath,
			content: after,
			atomic: true,
			backup,
		});
		backupPath = write.backupPath;

		const syntaxValid = await validateSyntax(absPath, detection);
		return {
			changes: syntheticNativeChanges(count),
			totalChanges: count,
			backupPath,
			editTime: performance.now() - t0,
			method: "native-string",
			syntaxValid,
		};
	}

	private async editWithAstGrep(
		options: AstEditOptions,
		absPath: string,
		detection: DetectionResult,
		preview: boolean,
		backup: boolean,
		t0: number,
	): Promise<AstEditResult> {
		const cmd = this.resolveAstGrepCommand()!;
		const pattern = buildRewritePattern(options.pattern, options.nodeType);
		const lang = astGrepLanguageForFile(absPath, detection.codeLanguage);
		const strictness = strictnessForNodeType(options.nodeType);

		const jsonOut = await spawnAstGrepOrThrow(this.grepSpawn, cmd, {
			pattern,
			replacement: options.replacement,
			lang,
			strictness,
			target: absPath,
			cwd: options.cwd ?? process.cwd(),
			jsonCompact: true,
			updateAll: false,
		}, "match scan");

		const meta = parseCompactMatchScan(jsonOut);
		let previewCombined = "";
		if (preview) {
			const previewOut = await spawnAstGrepOrThrow(this.grepSpawn, cmd, {
				pattern,
				replacement: options.replacement,
				lang,
				strictness,
				target: absPath,
				cwd: options.cwd ?? process.cwd(),
				jsonCompact: false,
				updateAll: false,
			}, "preview");
			assertDiffuseAstGrepExit(previewOut, "preview");
			previewCombined = `${previewOut.stdout}${previewOut.stderr}`.trim();
		}

		const previewDiff = preview
			? previewCombined.length > 0
				? `${previewCombined}\n`
				: "(no rewrite preview output)\n"
			: undefined;

		if (preview) {
			return {
				changes: meta.changes,
				totalChanges: meta.totalChanges,
				previewDiff: previewDiff!,
				editTime: performance.now() - t0,
				method: "ast-grep",
				syntaxValid: true,
			};
		}

		if (meta.totalChanges === 0) {
			return {
				changes: [],
				totalChanges: 0,
				editTime: performance.now() - t0,
				method: "ast-grep",
				syntaxValid: true,
			};
		}

		const dir = path.dirname(absPath);
		const base = path.basename(absPath);
		const ext = path.extname(base);
		const stem = ext ? base.slice(0, -ext.length) : base;
		/** Hidden scratch file MUST keep `${ext}` as the true suffix — ast-grep rejects `.foo.ts....tmp` even with `-l`. */
		const tmp = path.join(dir, `.edit.${stem}.${randomBytes(4).toString("hex")}${ext}`);
		await fs.copyFile(absPath, tmp);
		try {
			const applied = await spawnAstGrepOrThrow(this.grepSpawn, cmd, {
					pattern,
					replacement: options.replacement,
					lang,
					strictness,
					target: tmp,
					cwd: options.cwd ?? process.cwd(),
					jsonCompact: false,
					updateAll: true,
				}, "apply rewrite");

			assertStderrFatal(applied.stderr, "apply rewrite");

			const applyCode = applied.code ?? 0;
			if (applyCode !== 0) {
				throw new AstEditError(
					`ast-grep (apply rewrite) exited ${applied.code}: ${(applied.stderr || applied.stdout).trim().slice(0, 600)}`,
				);
			}

			const newContent = await fs.readFile(tmp, "utf8");

			const write = await this.writer.write({
				path: absPath,
				content: newContent,
				atomic: true,
				backup,
			});

			const syntaxValid = await validateSyntax(absPath, detection);
			return {
				changes: meta.changes,
				totalChanges: meta.totalChanges,
				backupPath: write.backupPath,
				editTime: performance.now() - t0,
				method: "ast-grep",
				syntaxValid,
			};
		} finally {
			await fs.unlink(tmp).catch(() => {});
		}
	}
}

// ── ast-grep runner ───────────────────────────────────────────────

async function spawnAstGrep(cmd: string, opts: AstGrepSpawnOpts): Promise<AstGrepSpawnResult> {
	const args: string[] = ["run", "-p", opts.pattern, "-r", opts.replacement];
	if (opts.lang) {
		args.push("-l", opts.lang);
	}
	if (opts.strictness) {
		args.push("--strictness", opts.strictness);
	}
	if (opts.jsonCompact) {
		args.push("--json=compact");
	}
	if (opts.updateAll) {
		args.push("-U");
	}
	args.push(opts.target);

	return new Promise((resolve, reject) => {
		let settled = false;
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		const proc = spawn(cmd, args, {
			stdio: ["ignore", "pipe", "pipe"],
			cwd: opts.cwd,
		});

		proc.stdout?.on("data", (d: Buffer) => stdoutChunks.push(d));
		proc.stderr?.on("data", (d: Buffer) => stderrChunks.push(d));

		proc.on("error", (err: Error) => {
			if (settled) return;
			settled = true;
			reject(err);
		});

		proc.on("close", (code: number | null) => {
			if (settled) return;
			settled = true;
			resolve({
				code,
				stdout: Buffer.concat(stdoutChunks).toString("utf8"),
				stderr: Buffer.concat(stderrChunks).toString("utf8"),
			});
		});
	});
}

/** Treat ast-grep `ERROR:` lines as hard failures (`Warning:` lines are tolerated). */
function assertStderrFatal(stderr: string, phase: string): void {
	if (/^\s*ERROR:/m.test(stderr)) {
		throw new AstEditError(`ast-grep (${phase}): ${stderr.trim()}`);
	}
}

/** Non-JSON ast-grep phases (diff preview): treat only `ERROR:` stderr plus exit `{0,1}` as benign. */
function assertDiffuseAstGrepExit(out: AstGrepSpawnResult, phase: string): void {
	assertStderrFatal(out.stderr, phase);
	const cc = out.code ?? 0;
	if (cc !== 0 && cc !== 1) {
		throw new AstEditError(
			`ast-grep (${phase}) exited ${out.code}: ${(out.stderr.trim() || out.stdout.trim()).slice(0, 600)}`,
		);
	}
}

async function spawnAstGrepOrThrow(
	runner: AstGrepSpawnFn,
	cmd: string,
	opts: AstGrepSpawnOpts,
	phase: string,
): Promise<AstGrepSpawnResult> {
	try {
		return await runner(cmd, opts);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new AstEditError(`ast-grep (${phase}) failed to start — is \`${cmd}\` installed or path valid? ${msg}`);
	}
}

interface RewriteParse {
	totalChanges: number;
	changes: AstChange[];
}

/**
 * Parse `--json=compact` output and validate process exit semantics.
 *
 * ast-grep (like ripgrep) uses exit code **1** for “successful run but zero structured matches”; **0**
 * denotes matches returned. Anything else surfaces as {@link AstEditError}.
 *
 * Exported for focused unit coverage without spawning a subprocess.
 */
export function parseCompactMatchScan(out: AstGrepSpawnResult): RewriteParse {
	assertStderrFatal(out.stderr, "match scan");
	const cc = out.code ?? 0;
	if (cc !== 0 && cc !== 1) {
		throw new AstEditError(
			`ast-grep (match scan) exited ${out.code}: ${(out.stderr.trim() || out.stdout.trim()).slice(0, 600)}`,
		);
	}

	const trimmed = out.stdout.trim();
	if (!trimmed) {
		return { totalChanges: 0, changes: [] };
	}

	try {
		const arr = JSON.parse(trimmed) as Array<{
			text?: string;
			replacement?: string;
			range?: { start?: { line?: number; column?: number } };
		}>;
		if (!Array.isArray(arr)) {
			throw new AstEditError(
				`ast-grep (match scan): expected JSON array from --json=compact; got ${trimmed.slice(0, 200)}`,
			);
		}
		const changes: AstChange[] = arr.map(m => ({
			line: m.range?.start?.line,
			column: m.range?.start?.column,
			before: m.text,
			after: m.replacement,
		}));
		return { totalChanges: arr.length, changes };
	} catch (e) {
		if (e instanceof AstEditError) {
			throw e;
		}
		throw new AstEditError(
			`ast-grep (match scan): malformed JSON (${e instanceof Error ? e.message : String(e)}) — excerpt: ${trimmed.slice(0, 200)}`,
		);
	}
}

// ── Native helpers ─────────────────────────────────────────────────

function countLiteralOccurrences(haystack: string, needle: string): number {
	if (needle === "") {
		return 0;
	}
	let n = 0;
	let i = haystack.indexOf(needle);
	while (i !== -1) {
		n++;
		i = haystack.indexOf(needle, i + needle.length);
	}
	return n;
}

function replaceAllLiteral(haystack: string, needle: string, repl: string): string {
	if (needle === "") {
		return haystack;
	}
	return haystack.split(needle).join(repl);
}

function syntheticNativeChanges(count: number): AstChange[] {
	if (count <= 0) {
		return [];
	}
	return Array.from({ length: Math.min(count, 64) }, () => ({
		before: "(matched literal)",
		after: "(replaced literal)",
	}));
}

function formatNativePreview(relName: string, before: string, after: string): string {
	if (before === after) {
		return "(no changes)\n";
	}
	const a = before.split("\n");
	const b = after.split("\n");
	const lines = [`--- ${relName}`, `+++ ${relName}`, "@@ native literal replace @@"];

	const maxLines = Math.max(a.length, b.length);
	const cap = Math.min(maxLines, 40);
	for (let i = 0; i < cap; i++) {
		const left = a[i] ?? "";
		const right = b[i] ?? "";
		if (left === right) {
			lines.push(` ${left}`);
		} else {
			if (left.length) {
				lines.push(`-${left}`);
			}
			if (right.length) {
				lines.push(`+${right}`);
			}
		}
	}
	if (maxLines > cap) {
		lines.push(`... (${maxLines - cap} more lines truncated)`);
	}
	return `${lines.join("\n")}\n`;
}

// ── Syntax validation ─────────────────────────────────────────────

export async function validateSyntax(
	absPath: string,
	detection: DetectionResult,
): Promise<boolean> {
	if (detection.fileType !== "code") {
		return true;
	}
	const lang = detection.codeLanguage;
	if (lang === "typescript" || lang === "javascript") {
		const r = spawnSync("bun", ["build", "--no-bundle", absPath], { encoding: "utf8" });
		return r.status === 0;
	}
	if (lang === "python") {
		const r = spawnSync("python3", ["-m", "py_compile", absPath], { encoding: "utf8" });
		return r.status === 0;
	}
	return true;
}
