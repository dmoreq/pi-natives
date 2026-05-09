/**
 * Smart file reader — routes by file type to ast-grep / jq / yq / bat with fallbacks.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { debuglog } from "node:util";

import { checkBinary } from "./shared/cli.ts";
import { SmartReadError } from "./shared/errors.ts";
import { truncateOutput } from "./shared/truncate.ts";
import { estimateTokens } from "./shared/utils.ts";
import {
	FileTypeDetector,
	astGrepLanguageForFile,
	codeSkeletonPatterns,
	type CodeLanguage,
	type DetectionResult,
	type EnhancedReadResult,
} from "./read-router.ts";

const debugAstGrepParse = debuglog("pi-sherlock:ast-grep-parse");

// ── Command runner (injectable for tests) ───────────────────────────

export interface SmartReaderCommandRunner {
	run(
		command: string,
		args: string[],
		options?: { cwd?: string },
	): { status: number; stdout: string; stderr: string };
}

const defaultRunner: SmartReaderCommandRunner = {
	run(cmd, args, opts) {
		const r = spawnSync(cmd, args, {
			encoding: "utf-8",
			cwd: opts?.cwd,
			maxBuffer: 50 * 1024 * 1024,
		});
		return {
			status: r.status ?? 1,
			stdout: typeof r.stdout === "string" ? r.stdout : String(r.stdout ?? ""),
			stderr: typeof r.stderr === "string" ? r.stderr : String(r.stderr ?? ""),
		};
	},
};

// ── Options ────────────────────────────────────────────────────────

export interface SmartReadOptions {
	filePath: string;
	cwd: string;
	jqQuery?: string;
	yqQuery?: string;
}

// ── Reader ───────────────────────────────────────────────────────────

export interface SmartFileReaderOptions {
	commandRunner?: SmartReaderCommandRunner;
	detector?: FileTypeDetector;
}

function resolveAstGrepBinary(): string | null {
	if (checkBinary("ast-grep")) return "ast-grep";
	if (checkBinary("sg")) return "sg";
	return null;
}

function parseAstGrepJson(stdout: string): string[] {
	const texts: string[] = [];
	try {
		const raw = JSON.parse(stdout || "[]") as Array<{ text?: string }>;
		for (const m of raw) {
			if (m.text && m.text.trim()) texts.push(m.text.trim());
		}
	} catch (e) {
		debugAstGrepParse("parseAstGrepJson failed: %s", e instanceof Error ? e.stack ?? e.message : String(e));
	}
	return texts;
}

export class SmartFileReader {
	private readonly runner: SmartReaderCommandRunner;
	private readonly detector: FileTypeDetector;

	constructor(opts: SmartFileReaderOptions = {}) {
		this.runner = opts.commandRunner ?? defaultRunner;
		this.detector = opts.detector ?? new FileTypeDetector();
	}

	/**
	 * Read a file via the smart router.
	 *
	 * Does **not** honor cancellation: all work uses synchronous filesystem and process spawns,
	 * and no `AbortSignal` is accepted. Passing a signal from a tool wrapper has no effect.
	 */
	async read(options: SmartReadOptions): Promise<EnhancedReadResult> {
		const t0 = performance.now();
		const fallbacks: string[] = [];
		const absPath = path.isAbsolute(options.filePath)
			? path.normalize(options.filePath)
			: path.resolve(options.cwd, options.filePath);

		let stat: fs.Stats;
		try {
			stat = fs.statSync(absPath);
		} catch {
			throw new SmartReadError(`Not a file or missing: ${options.filePath}`);
		}
		if (!stat.isFile()) {
			throw new SmartReadError(`Not a file or missing: ${options.filePath}`);
		}

		const fileSizeBytes = stat.size;
		const detection = this.detector.detect(absPath);

		let core: Omit<EnhancedReadResult, "readTimeMs" | "fileSizeBytes" | "estimatedTokens" | "fallbacks">;

		if (detection.fileType === "data") {
			core = await this.readData(absPath, detection, options, fallbacks);
		} else if (detection.fileType === "code") {
			core = await this.readCode(absPath, detection, fallbacks);
		} else {
			core = await this.readText(absPath, fallbacks);
		}

		return {
			...core,
			readTimeMs: Math.round(performance.now() - t0),
			fileSizeBytes,
			estimatedTokens: estimateTokens(core.content),
			fallbacks: [...fallbacks],
		};
	}

	private async readData(
		absPath: string,
		detection: DetectionResult,
		options: SmartReadOptions,
		fallbacks: string[],
	): Promise<Omit<EnhancedReadResult, "readTimeMs" | "fileSizeBytes" | "estimatedTokens" | "fallbacks">> {
		const fmt = detection.dataFormat;
		const raw = fs.readFileSync(absPath, "utf-8");

		if (fmt === "json") {
			const jq = checkBinary("jq");
			if (jq) {
				const q = options.jqQuery ?? ".";
				const r = this.runner.run("jq", [q, absPath], {});
				if (r.status === 0) {
					return {
						content: r.stdout.trimEnd(),
						method: "jq",
						fileType: "data",
						dataFormat: "json",
					};
				}
				fallbacks.push("jq-failed");
			} else {
				fallbacks.push("jq-unavailable");
			}
			try {
				const parsed = JSON.parse(raw) as unknown;
				const pretty = JSON.stringify(parsed, null, 2);
				return {
					content: pretty,
					method: "native-json",
					fileType: "data",
					dataFormat: "json",
				};
			} catch {
				return {
					content: raw,
					method: "native-json",
					fileType: "data",
					dataFormat: "json",
				};
			}
		}

		if (fmt === "yaml") {
			const yqOut = this.tryYq(absPath, options.yqQuery ?? ".", fallbacks);
			if (yqOut !== null) {
				return {
					content: yqOut.text,
					method: yqOut.method,
					fileType: "data",
					dataFormat: "yaml",
				};
			}
			const lines = raw.split("\n");
			const cap = Math.min(lines.length, 300);
			return {
				content:
					lines.slice(0, cap).join("\n") + (lines.length > cap ? "\n...\n(native YAML excerpt)" : ""),
				method: "native-yaml-text",
				fileType: "data",
				dataFormat: "yaml",
			};
		}

		if (fmt === "toml" || fmt === "xml") {
			if (checkBinary("yq")) {
				const q = options.yqQuery ?? ".";
				const parser = fmt === "toml" ? (["-p", "toml"] as const) : (["-p", "xml"] as const);
				const yqAttempts: string[][] = [
					["eval", ...parser, q, absPath],
					["e", ...parser, q, absPath],
				];
				for (const args of yqAttempts) {
					const r = this.runner.run("yq", args, {});
					if (r.status === 0 && r.stdout.trim()) {
						return {
							content: r.stdout.trimEnd(),
							method: "yq-mikefarah",
							fileType: "data",
							dataFormat: fmt,
						};
					}
				}
				fallbacks.push("yq-toml-xml-failed");
			}
			const lines = raw.split("\n");
			const head = lines.slice(0, 220).join("\n");
			return {
				content: head + (lines.length > 220 ? "\n...\n(native excerpt)" : ""),
				method: "native-text",
				fileType: "data",
				dataFormat: fmt,
			};
		}

		if (fmt === "csv") {
			if (checkBinary("yq")) {
				const q = options.yqQuery ?? ".";
				const yqAttempts: string[][] = [
					["eval", "-p", "csv", q, absPath],
					["e", "-p", "csv", q, absPath],
				];
				for (const args of yqAttempts) {
					const r = this.runner.run("yq", args, {});
					if (r.status === 0) {
						return {
							content: r.stdout.trimEnd(),
							method: "yq-mikefarah",
							fileType: "data",
							dataFormat: "csv",
						};
					}
				}
				fallbacks.push("yq-csv-failed");
			} else {
				fallbacks.push("yq-unavailable");
			}
			const lines = raw.split("\n");
			const head = lines.slice(0, 220).join("\n");
			return {
				content: head + (lines.length > 220 ? "\n...\n(native CSV excerpt)" : ""),
				method: "native-csv-text",
				fileType: "data",
				dataFormat: "csv",
			};
		}

		const lines = raw.split("\n");
		return {
			content: lines.slice(0, 250).join("\n"),
			method: "native-text",
			fileType: detection.fileType,
			dataFormat: fmt,
		};
	}

	private tryYq(
		absPath: string,
		query: string,
		fallbacks: string[],
	): { text: string; method: "yq-mikefarah" | "yq-other" } | null {
		if (!checkBinary("yq")) {
			fallbacks.push("yq-unavailable");
			return null;
		}

		const attempts: Array<[string, string[]]> = [
			["yq", ["eval", query, absPath]],
			["yq", ["e", query, absPath]],
			["yq", [query, absPath]],
		];

		for (const [cmd, args] of attempts) {
			const primary = this.runner.run(cmd, args, {});
			if (primary.status === 0 && primary.stdout.replace(/\s/g, "").length > 0) {
				const isEvalStyle = args[0] === "eval" || args[0] === "e";
				return { text: primary.stdout.trimEnd(), method: isEvalStyle ? "yq-mikefarah" : "yq-other" };
			}
		}

		fallbacks.push("yq-failed");
		return null;
	}

	private async readCode(
		absPath: string,
		detection: DetectionResult,
		fallbacks: string[],
	): Promise<Omit<EnhancedReadResult, "readTimeMs" | "fileSizeBytes" | "estimatedTokens" | "fallbacks">> {
		const lang = detection.codeLanguage ?? "other";
		const sgBin = resolveAstGrepBinary();
		const astLang = astGrepLanguageForFile(absPath, lang);

		if (sgBin && astLang && lang !== "other") {
			const patterns = codeSkeletonPatterns(lang, absPath);
			const chunks: string[] = [];
			for (const pattern of patterns) {
				const args = ["run", "--json", "-p", pattern, "-l", astLang, absPath];
				const r = this.runner.run(sgBin, args, {});
				if (r.status !== 0 && r.status !== 1) {
					fallbacks.push(`ast-grep-exit-${r.status}`);
					continue;
				}
				const texts = parseAstGrepJson(r.stdout);
				if (texts.length === 0) continue;
				chunks.push(`### ${pattern}\n${texts.map(t => `- \`${t.replace(/`/g, "'")}\``).join("\n")}`);
			}
			const body = chunks.join("\n\n");
			if (body.trim()) {
				return {
					content: body,
					method: "ast-grep",
					fileType: "code",
					codeLanguage: lang,
				};
			}
			fallbacks.push("ast-grep-empty");
		} else {
			fallbacks.push(sgBin ? "ast-grep-language-unsupported" : "ast-grep-unavailable");
		}

		return this.tryBatThenNative(absPath, "code", lang, detection.dataFormat, fallbacks);
	}

	private async readText(
		absPath: string,
		fallbacks: string[],
	): Promise<Omit<EnhancedReadResult, "readTimeMs" | "fileSizeBytes" | "estimatedTokens" | "fallbacks">> {
		const detection = this.detector.detect(absPath);
		return this.tryBatThenNative(
			absPath,
			"text",
			detection.codeLanguage,
			detection.dataFormat,
			fallbacks,
		);
	}

	private tryBatThenNative(
		absPath: string,
		fileType: DetectionResult["fileType"],
		codeLanguage: CodeLanguage | undefined,
		dataFormat: DetectionResult["dataFormat"],
		fallbacks: string[],
	): Omit<EnhancedReadResult, "readTimeMs" | "fileSizeBytes" | "estimatedTokens" | "fallbacks"> {
		if (checkBinary("bat")) {
			const r = this.runner.run(
				"bat",
				["--color=never", "--style=numbers,changes", "--paging=never", absPath],
				{},
			);
			if (r.status === 0 && r.stdout) {
				return {
					content: r.stdout.trimEnd(),
					method: "bat",
					fileType,
					codeLanguage,
					dataFormat,
				};
			}
			fallbacks.push("bat-failed");
		} else {
			fallbacks.push("bat-unavailable");
		}

		const raw = fs.readFileSync(absPath, "utf-8");
		const trunc = truncateOutput(raw);
		fallbacks.push("native-read");
		return {
			content: trunc.text,
			method: "native-text",
			fileType,
			codeLanguage,
			dataFormat,
		};
	}
}
