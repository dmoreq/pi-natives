/**
 * Structured shell execution with Nushell `| to json` pipelines and POSIX fallbacks.
 *
 * POSIX “Bun” tier uses **`Bun.$`** tagged templates (`import { $ } from "bun"` is identical at runtime).
 */
import { checkBinary } from "./shared/cli.ts";

// ── Public types ────────────────────────────────────────────────────

export interface NushellJsonOptions {
	command: string;
	enforceJson?: boolean;
	timeout?: number;
	cwd?: string;
	env?: Record<string, string>;
	fallbackToBun?: boolean;
	/** Agent / host cancellation forwarded into `Bun.spawn` backends and raced for the Bun.`$` tier. */
	signal?: AbortSignal;
}

/** Matches the enhancement-plan contract exactly (`output` is intentionally `any`). */
export interface NushellJsonResult {
	output: any;
	rawOutput: string;
	exitCode: number;
	executionTime: number;
	shell: "nushell" | "bun" | "bash";
	structured: boolean;
	performance: {
		startupTime: number;
		executionTime: number;
	};
}

export interface ShellBackendRunResult {
	code: number;
	stdout: string;
	stderr: string;
	startupMs: number;
	executionMs: number;
}

/** Options passed down to POSIX / Nu subprocess runners (timeout + cooperative abort). */
export interface ShellBackendOpts {
	cwd?: string;
	env?: Record<string, string>;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export interface ShellDeps {
	whichNu: () => string | null;
	runNu: (nuExe: string, script: string, opts: ShellBackendOpts) => Promise<ShellBackendRunResult>;
	runBunShell: (command: string, opts: ShellBackendOpts) => Promise<ShellBackendRunResult>;
	runBash: (command: string, opts: ShellBackendOpts) => Promise<ShellBackendRunResult>;
}

// ── Pipeline enhancement ─────────────────────────────────────────────

/** True when the trimmed command commonly benefits from a JSON-ending nu pipeline. */
export function isStructurableCommand(command: string): boolean {
	const t = command.trim();
	return (
		/^(?:ls)\b/u.test(t) ||
		t === "env" ||
		/^(?:pwd)\b/u.test(t) ||
		/^(?:ps)\b/u.test(t) ||
		/^git\s+log\b/u.test(t) ||
		/^git\s+status\b/u.test(t)
	);
}

/** Map a user POSIX-style command fragment into Nushell that ends with structured JSON emit. */
export function enforceJsonPipeline(command: string): { nuScript: string; enhanced: boolean } {
	const trimmed = command.trim();
	if (!isStructurableCommand(trimmed)) {
		return { nuScript: trimmed, enhanced: false };
	}

	if (/^git\s+log\b/u.test(trimmed)) {
		const hasFormat =
			/\s--(?:format|pretty)(?:=|\s+)/u.test(trimmed) ||
			/\s--(?:pretty|format)\s+/u.test(trimmed);
		const withJson = hasFormat ? trimmed : `${trimmed} --format=json`;
		const nuScript = `${withJson} | lines | filter {|l| not ($l | is-empty)} | each {|line| $line | from json} | to json`;
		return { nuScript, enhanced: true };
	}

	if (/^git\s+status\b/u.test(trimmed)) {
		const withPorcelain =
			/\s--porcelain(?:=v1)?(?:\s|$)/u.test(trimmed) ?
				trimmed
			:	`${trimmed} --porcelain=v1`;
		const nuScript = `${withPorcelain} | lines | filter {|l| not ($l | is-empty)} | each {|l| {status_xy: ($l | str substring 0..2), path: ($l | str substring 3..) }} | to json`;
		return { nuScript, enhanced: true };
	}

	if (/^ls\b/u.test(trimmed)) {
		const nuScript = `${trimmed} | select name type size modified target | to json`;
		return { nuScript, enhanced: true };
	}

	if (/^ps\b/u.test(trimmed)) {
		const nuScript = `${trimmed} | select pid name cpu mem | to json`;
		return { nuScript, enhanced: true };
	}

	if (trimmed === "env" || /^env\s*$/u.test(trimmed)) {
		return { nuScript: "$env | to json", enhanced: true };
	}

	if (/^pwd\b/u.test(trimmed)) {
		return { nuScript: "{ cwd: $env.PWD } | to json", enhanced: true };
	}

	return { nuScript: trimmed, enhanced: false };
}

function sanitizeKey(cell: string): string {
	let k = cell.replace(/#/gu, "").trim().toLowerCase();
	k = k.replace(/\s+/gu, "_");
	if (!k) return "col";
	return k.replace(/[^\w]/gu, "_");
}

function splitPipeCells(line: string): string[] {
	return line.split("│").map(s => s.trim()).filter(Boolean);
}

/**
 * Recover rows from ASCII “box” tables Nushell prints without `to json`,
 * loosely matching lines that contain Unicode/ASCII column bars.
 */
export function parseNushellTable(text: string): Array<Record<string, string>> {
	const lines = text.split(/\r?\n/u).filter(Boolean);
	const headerIdx = lines.findIndex(l => /[#＃]/u.test(l) && /│|\|/u.test(l));
	if (headerIdx === -1) return [];

	const rawHeader = lines[headerIdx]!;
	const headerCols = splitPipeCells(rawHeader);
	if (!headerCols.length) return [];

	const keys = headerCols.map((h, i) => (i === 0 ? "_" : sanitizeKey(h)));

	const rows: Array<Record<string, string>> = [];

	for (let i = headerIdx + 1; i < lines.length; i++) {
		const line = lines[i]!;
		if (!/│|\|/u.test(line)) continue;
		if (/^[\s──┴┬├┤└┘┌┐|]+$/u.test(line.replace(/│/gu, "").replace(/\|/gu, ""))) continue;
		const cells = splitPipeCells(line);
		if (cells.length < 2) continue;
		const rec: Record<string, string> = {};
		for (let c = 0; c < Math.min(keys.length, cells.length); c++) {
			rec[keys[c] ?? `col_${c}`] = cells[c]!;
		}
		rows.push(rec);
	}

	return rows;
}

// ── Parsing & assembly ─────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 120_000;

function mergeEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
	return { ...(process.env as NodeJS.ProcessEnv), ...extra };
}

function safeJsonParse(s: string): unknown | undefined {
	try {
		return JSON.parse(s) as unknown;
	} catch {
		return undefined;
	}
}

/** Best-effort: find outermost `{`/`[` blob for sloppy stdout. */
function extractJson(text: string): unknown | undefined {
	const startObj = text.indexOf("{");
	const startArr = text.indexOf("[");
	let start = -1;
	if (startObj === -1) start = startArr;
	else if (startArr === -1) start = startObj;
	else start = Math.min(startObj, startArr);

	if (start === -1) return undefined;

	for (let depth = 0, inStr = false, esc = false, end = start; end < text.length; end++) {
		const ch = text[end]!;
		if (inStr) {
			if (esc) esc = false;
			else if (ch === "\\") esc = true;
			else if (ch === "\"") inStr = false;
			continue;
		}
		if (ch === "\"") {
			inStr = true;
			continue;
		}
		if (ch === "{" || ch === "[") depth++;
		if (ch === "}" || ch === "]") {
			depth--;
			if (depth === 0) {
				const slice = text.slice(start, end + 1);
				return safeJsonParse(slice);
			}
		}
	}
	return undefined;
}

function tryInterpretStructured(stdout: string): { structured: boolean; output: unknown } {
	const trimmed = stdout.trim();

	const direct = safeJsonParse(trimmed);
	if (direct !== undefined) return { structured: true, output: direct };

	const loosened = extractJson(trimmed);
	if (loosened !== undefined) return { structured: true, output: loosened };

	const rows = parseNushellTable(stdout);
	if (rows.length > 0) return { structured: true, output: rows };

	return {
		structured: false,
		output: trimmed.length === 0 ? { rawText: "" } : { rawText: stdout },
	};
}

function buildShellResultFromRun(shell: NushellJsonResult["shell"], rawOut: ShellBackendRunResult): NushellJsonResult {
	const interp = tryInterpretStructured(rawOut.stdout);
	const err = rawOut.stderr.trim();

	let output: any = interp.output;
	if (!interp.structured && err) {
		if (interp.output !== null && typeof interp.output === "object" && !Array.isArray(interp.output)) {
			output = { ...interp.output, stderr: err };
		} else {
			output = { rawText: rawOut.stdout, stderr: err };
		}
	}

	return {
		shell,
		exitCode: rawOut.code,
		rawOutput: rawOut.stdout,
		executionTime: rawOut.executionMs,
		output,
		structured: interp.structured,
		performance: {
			startupTime: rawOut.startupMs,
			executionTime: rawOut.executionMs,
		},
	};
}

/**
 * POSIX fast path mandated by spec: **`Bun.$`** tagged templates (`import { $ } from "bun"` is equivalent).
 *
 * Runs through `sh -c` / `cmd /d/s/c` so arbitrary agent command strings behave like normal POSIX shells.
 *
 * Cooperative `signal` rejects the awaited shell Promise (exit **125**) without a Bun-native kill-switch; wall-clock timeouts still apply elsewhere.
 */
export async function runBunShellViaBunDollar(
	command: string,
	opts: ShellBackendOpts,
): Promise<ShellBackendRunResult> {
	const t0 = performance.now();

	const merged: Record<string, string | undefined> = {
		...(process.env as Record<string, string | undefined>),
		...opts.env,
	};

	let tStartup = t0;

	const abortReject =
		opts.signal ?
			new Promise<never>((_, reject) => {
				const sig = opts.signal!;
				const onAbort = () => reject(sig.reason ?? new DOMException("Aborted", "AbortError"));
				if (sig.aborted) return onAbort();
				sig.addEventListener("abort", onAbort, { once: true });
			})
		:	null;

	try {
		tStartup = performance.now();
		let pending =
			process.platform === "win32" ?
				Bun.$`cmd /d/s/c ${command}`.nothrow().quiet().env(merged)
			:	Bun.$`sh -c ${command}`.nothrow().quiet().env(merged);

		pending = opts.cwd ? pending.cwd(opts.cwd) : pending;

		const awaited = abortReject !== null ? Promise.race([pending, abortReject]) : pending;
		const out = await awaited;
		const tEnd = performance.now();

		return {
			code: out.exitCode,
			stdout: out.stdout.toString(),
			stderr: out.stderr.toString(),
			startupMs: tStartup - t0,
			executionMs: tEnd - tStartup,
		};
	} catch (e: unknown) {
		const tEnd = performance.now();
		const shellErr =
			e !== null &&
			typeof e === "object" &&
			"exitCode" in e &&
			"stdout" in e &&
			"stderr" in e ?
				(e as { exitCode: number; stdout: Buffer; stderr: Buffer })
			:	null;

		const startupMs = tStartup - t0;
		const executionMs = Math.max(0, tEnd - tStartup);

		if (shellErr) {
			return {
				code: shellErr.exitCode,
				stdout: shellErr.stdout.toString(),
				stderr: shellErr.stderr.toString(),
				startupMs,
				executionMs,
			};
		}

		const cancelled =
			opts.signal?.aborted === true ?
				true
			:	e instanceof DOMException ?
				e.name === "AbortError"
			:	false;
		const msg =
			cancelled ?
				opts.signal?.reason ?
					String(opts.signal.reason)
				:	"aborted"
			:	`${e}`;

		return {
			code: cancelled ? 125 : 1,
			stdout: "",
			stderr: msg,
			startupMs,
			executionMs,
		};
	}
}

async function bunSpawnCollect(
	cmd: readonly string[],
	options: ShellBackendOpts,
): Promise<ShellBackendRunResult> {
	const t0 = performance.now();
	const mergedEnv = mergeEnv(options.env);
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const userSig = options.signal;
	if (userSig?.aborted) {
		const t1 = performance.now();
		const startupMs = t1 - t0;
		return {
			code: 125,
			stdout: "",
			stderr: userSig.reason ? String(userSig.reason) : "aborted",
			startupMs,
			executionMs: 0,
		};
	}

	const timerCtl = new AbortController();
	const abortTimer = setTimeout(() => {
		timerCtl.abort(new DOMException("Shell command timed out", "AbortError"));
	}, timeoutMs);

	const mergedSpawnSignal =
		userSig ? AbortSignal.any([timerCtl.signal, userSig]) : timerCtl.signal;

	let proc!: ReturnType<typeof Bun.spawn>;
	let t1: number;

	try {
		proc = Bun.spawn(Array.from(cmd), {
			cwd: options.cwd,
			env: mergedEnv,
			stdout: "pipe",
			stderr: "pipe",
			stdin: "ignore",
			signal: mergedSpawnSignal,
		});
		t1 = performance.now();
	} catch {
		clearTimeout(abortTimer);
		const startupMs = performance.now() - t0;
		const aborted = mergedSpawnSignal.aborted;
		const userCanceled = !!userSig?.aborted;
		return {
			code: aborted ? (userCanceled ? 125 : 124) : 1,
			stdout: "",
			stderr:
				userCanceled ?
					userSig?.reason ?
						String(userSig.reason)
					:	"aborted"
				: mergedSpawnSignal.aborted ?
					"Shell command timed out"
				:	"failed to spawn process",
			startupMs,
			executionMs: Math.max(0, startupMs),
		};
	}

	const stdoutP = proc.stdout ? new Response(proc.stdout).text() : Promise.resolve("");
	const stderrP = proc.stderr ? new Response(proc.stderr).text() : Promise.resolve("");
	const [stdoutText, stderrText] = await Promise.all([stdoutP, stderrP]);
	clearTimeout(abortTimer);

	let exitCode: number | null;
	try {
		exitCode = await proc.exited;
	} catch {
		exitCode =
			mergedSpawnSignal.aborted ?
				userSig?.aborted ?
					125
				:	124
			:	null;
	}
	const t2 = performance.now();

	let code = exitCode ?? 1;
	if (mergedSpawnSignal.aborted) {
		code = userSig?.aborted ? 125 : 124;
	}

	return {
		code,
		stdout: stdoutText,
		stderr: stderrText,
		startupMs: t1 - t0,
		executionMs: t2 - t1,
	};
}

export function createDefaultShellDeps(): ShellDeps {
	return {
		whichNu: () => checkBinary("nu"),
		runNu: (nuExe, script, opts) =>
			bunSpawnCollect([nuExe, "-c", script], {
				cwd: opts.cwd,
				env: opts.env,
				timeoutMs: opts.timeoutMs,
				signal: opts.signal,
			}),
		runBunShell: (command, opts) => runBunShellViaBunDollar(command, opts),
		runBash: (command, opts) => {
			if (process.platform === "win32") {
				return bunSpawnCollect(["cmd.exe", "/d", "/s", "/c", command], {
					cwd: opts.cwd,
					env: opts.env,
					timeoutMs: opts.timeoutMs,
					signal: opts.signal,
				});
			}
			const bash = checkBinary("bash");
			const shell = bash ?? "/bin/sh";
			return bunSpawnCollect([shell, "-c", command], {
				cwd: opts.cwd,
				env: opts.env,
				timeoutMs: opts.timeoutMs,
				signal: opts.signal,
			});
		},
	};
}

export interface NushellJsonExecutorCtorOptions {
	deps?: ShellDeps;
	fallbackToBunDefault?: boolean;
}

export class NushellJsonExecutor {
	private readonly deps: ShellDeps;

	private readonly fallbackToBunDefault: boolean;

	constructor(opts?: NushellJsonExecutorCtorOptions) {
		this.deps = opts?.deps ?? createDefaultShellDeps();
		this.fallbackToBunDefault = opts?.fallbackToBunDefault ?? true;
	}

	async execute(options: NushellJsonOptions): Promise<NushellJsonResult> {
		const trimmed = options.command.trim();
		const enforceJson = options.enforceJson !== false;
		const fallbackToBun = options.fallbackToBun ?? this.fallbackToBunDefault;
		const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
		const posixOpts: ShellBackendOpts = {
			cwd: options.cwd,
			env: options.env,
			timeoutMs,
			signal: options.signal,
		};

		const pipeline = enforceJsonPipeline(trimmed);
		const { enhanced, nuScript: pipedNu } = pipeline;
		const nuScript = enforceJson && pipeline.enhanced ? pipedNu : trimmed;

		const runPosix = async (mode: "bun" | "bash"): Promise<NushellJsonResult> => {
			const run = mode === "bun" ? this.deps.runBunShell : this.deps.runBash;
			const raw = await run(trimmed, posixOpts);
			return buildShellResultFromRun(mode, raw);
		};

		const tryBunThenMaybeBash = async (): Promise<NushellJsonResult> => {
			if (fallbackToBun) {
				const bunTier = await runPosix("bun");
				if (bunTier.exitCode === 0) return bunTier;
			}
			return runPosix("bash");
		};

		const nuPath = this.deps.whichNu();

		if (!nuPath) {
			return tryBunThenMaybeBash();
		}

		const nuRaw = await this.deps.runNu(nuPath, nuScript, posixOpts);
		const nuInterp = tryInterpretStructured(nuRaw.stdout);
		const nuResult = buildShellResultFromRun("nushell", nuRaw);

		const needsPosix =
			nuRaw.code !== 0 ||
			(enforceJson && enhanced && !nuInterp.structured);

		if (!needsPosix) return nuResult;

		return tryBunThenMaybeBash();
	}
}
