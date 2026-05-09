/**
 * High-throughput file output using Bun primitives: {@link Bun.write}, temp + rename,
 * and optional streamed writes for large payloads. No subprocesses or third-party writers.
 */
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as path from "node:path";
import type { BufferEncoding } from "node:buffer";

import { WriteEnhancedError } from "./shared/errors.ts";

/** Matches the core tools spec; optional streaming fields are extensions for large atomic payloads. */
export interface BunWriteOptions {
	path: string;
	content: string | Buffer;
	mode?: "write" | "append";
	/** For `mode: "write"`; ignored for append + non-atomic. Default true when replacing file contents. */
	atomic?: boolean;
	/** Copy existing target to `{path}.bak.{ms}` before replace (atomic or direct overwrite). */
	backup?: boolean;
	encoding?: string;
	/** Stream chunks to disk when payload exceeds {@link BunWriteOptions.streamingThresholdBytes}. */
	streaming?: boolean;
	streamingThresholdBytes?: number;
}

export interface BunWriteResult {
	bytesWritten: number;
	writeTime: number;
	atomic: boolean;
	backupPath?: string;
	method: "bun-atomic" | "bun-direct" | "bun-append";
}

const DEFAULT_STREAMING_THRESHOLD = 256 * 1024;

export class BunFileWriter {
	async write(options: BunWriteOptions): Promise<BunWriteResult> {
		const mode = options.mode ?? "write";
		const atomicDefault = mode === "write";
		const atomic = options.atomic ?? atomicDefault;

		const abs = path.resolve(options.path);
		const payload = normalizePayload(options.content, options.encoding);

		if (mode === "append") {
			if (atomic) {
				const prior = existsSync(abs) ? await Bun.file(abs).arrayBuffer() : new ArrayBuffer(0);
				const merged = concatBuffers(prior, payload);
				return this.writeAtomic(abs, merged, {
					backup: options.backup ?? false,
					streaming: options.streaming ?? false,
					streamingThresholdBytes: options.streamingThresholdBytes ?? DEFAULT_STREAMING_THRESHOLD,
				});
			}
			return this.appendContent(abs, payload);
		}

		if (atomic) {
			return this.writeAtomic(abs, payload, {
				backup: options.backup ?? false,
				streaming: options.streaming ?? false,
				streamingThresholdBytes: options.streamingThresholdBytes ?? DEFAULT_STREAMING_THRESHOLD,
			});
		}
		return this.writeDirect(abs, payload, options.backup ?? false);
	}

	private async writeDirect(
		absPath: string,
		payload: Buffer,
		backup: boolean,
	): Promise<BunWriteResult> {
		const t0 = performance.now();
		let backupPath: string | undefined;
		if (backup && existsSync(absPath)) {
			backupPath = makeBackupPath(absPath);
			await Bun.write(backupPath, Bun.file(absPath));
		}
		await Bun.write(absPath, payload);
		const writeTime = performance.now() - t0;
		return {
			bytesWritten: payload.byteLength,
			writeTime,
			atomic: false,
			backupPath,
			method: "bun-direct",
		};
	}

	private async writeAtomic(
		absPath: string,
		payload: Buffer,
		opts: { backup: boolean; streaming: boolean; streamingThresholdBytes: number },
	): Promise<BunWriteResult> {
		const t0 = performance.now();
		const dir = path.dirname(absPath);
		const base = path.basename(absPath);
		const tmp = path.join(dir, `${base}.tmp.${Date.now()}.${randomBytes(4).toString("hex")}`);

		let backupPath: string | undefined;
		if (opts.backup && existsSync(absPath)) {
			backupPath = makeBackupPath(absPath);
			await Bun.write(backupPath, Bun.file(absPath));
		}

		try {
			const useStream = opts.streaming && payload.byteLength >= opts.streamingThresholdBytes;
			if (useStream) {
				await streamBufferToPath(tmp, payload);
			} else {
				await Bun.write(tmp, payload);
			}
			await fs.rename(tmp, absPath);
		} catch (e) {
			await safeUnlink(tmp);
			throw e;
		}

		const writeTime = performance.now() - t0;
		return {
			bytesWritten: payload.byteLength,
			writeTime,
			atomic: true,
			backupPath,
			method: "bun-atomic",
		};
	}

	/**
	 * Non-atomic append uses read-merge + {@link Bun.write} (same as spec’s Bun-native I/O).
	 * This is sequential whole-file rewrite, not POSIX `O_APPEND` (use `atomic: true` for crash-safe swaps).
	 */
	private async appendContent(absPath: string, payload: Buffer): Promise<BunWriteResult> {
		const t0 = performance.now();
		const merged = concatBuffers(existsSync(absPath) ? await Bun.file(absPath).arrayBuffer() : new ArrayBuffer(0), payload);
		await Bun.write(absPath, merged);
		const writeTime = performance.now() - t0;
		return {
			bytesWritten: payload.byteLength,
			writeTime,
			atomic: false,
			method: "bun-append",
		};
	}
}

export async function restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
	if (!existsSync(backupPath)) {
		throw new WriteEnhancedError(`Backup not found: ${backupPath}`);
	}
	const abs = path.resolve(targetPath);
	await fs.mkdir(path.dirname(abs), { recursive: true });
	await Bun.write(abs, Bun.file(backupPath));
}

export async function benchmarkWrite(
	options: BunWriteOptions,
	iterations = 5,
): Promise<{
	iterations: number;
	results: BunWriteResult[];
	avgWriteTime: number;
	avgBytesWritten: number;
}> {
	const writer = new BunFileWriter();
	const results: BunWriteResult[] = [];
	for (let i = 0; i < iterations; i++) {
		results.push(await writer.write(options));
	}
	const avgWriteTime = results.reduce((s, r) => s + r.writeTime, 0) / results.length;
	const avgBytesWritten = results.reduce((s, r) => s + r.bytesWritten, 0) / results.length;
	return { iterations, results, avgWriteTime, avgBytesWritten };
}

function normalizePayload(content: string | Buffer, encoding?: string): Buffer {
	if (Buffer.isBuffer(content)) {
		return content;
	}
	const enc = encoding?.trim();
	if (enc && enc !== "utf8" && enc !== "utf-8") {
		return Buffer.from(content, enc as BufferEncoding);
	}
	return Buffer.from(content, "utf8");
}

function concatBuffers(a: ArrayBuffer, b: Buffer): Buffer {
	return Buffer.concat([Buffer.from(a), b]);
}

function makeBackupPath(absPath: string): string {
	return `${absPath}.bak.${Date.now()}`;
}

async function safeUnlink(p: string): Promise<void> {
	try {
		await fs.unlink(p);
	} catch {
		// ignore
	}
}

async function streamBufferToPath(tmpPath: string, payload: Buffer): Promise<void> {
	const chunkSize = 64 * 1024;
	const w = Bun.file(tmpPath).writer();
	try {
		for (let i = 0; i < payload.byteLength; i += chunkSize) {
			const slice = payload.subarray(i, Math.min(i + chunkSize, payload.byteLength));
			await w.write(slice);
		}
		await w.flush();
	} finally {
		await w.end();
	}
}
