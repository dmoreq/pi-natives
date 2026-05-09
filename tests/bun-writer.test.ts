/**
 * BunFileWriter + `write_enhanced` tool — atomic/direct/append paths, backups, benchmarking.
 */
import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { BunFileWriter, benchmarkWrite, restoreFromBackup } from "../src/bun-writer.ts";
import { registerWriteEnhancedTool } from "../src/tools/write-enhanced.ts";

let tmpRoot: string;

beforeEach(() => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bun-writer-"));
});

afterEach(() => {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function listTmpArtifacts(dir = tmpRoot) {
	const out: string[] = [];
	function walk(d: string) {
		for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, ent.name);
			if (ent.isDirectory()) walk(p);
			else out.push(ent.name);
		}
	}
	walk(dir);
	return out;
}

describe("BunFileWriter", () => {
	test("direct write uses bun-direct and leaves no stray .tmp files", async () => {
		const writer = new BunFileWriter();
		const file = path.join(tmpRoot, "out.txt");
		const r = await writer.write({
			path: file,
			content: "hello",
			atomic: false,
		});
		expect(r.method).toBe("bun-direct");
		expect(r.atomic).toBe(false);
		expect(await Bun.file(file).text()).toBe("hello");
		expect(r.bytesWritten).toBeGreaterThan(0);
		expect(r.writeTime).toBeGreaterThanOrEqual(0);
		expect(listTmpArtifacts().some(n => n.includes(".tmp."))).toBe(false);
	});

	test("atomic write uses temp + rename and records bun-atomic", async () => {
		const writer = new BunFileWriter();
		const file = path.join(tmpRoot, "atomic.txt");
		const r = await writer.write({ path: file, content: "x", atomic: true });
		expect(r.method).toBe("bun-atomic");
		expect(r.atomic).toBe(true);
		expect(await Bun.file(file).text()).toBe("x");
		expect(listTmpArtifacts().some(n => n.includes(".tmp."))).toBe(false);
	});

	test("atomic write replaces existing file cleanly", async () => {
		const writer = new BunFileWriter();
		const file = path.join(tmpRoot, "t.txt");
		await Bun.write(file, "old");
		await writer.write({ path: file, content: "new", atomic: true });
		expect(await Bun.file(file).text()).toBe("new");
	});

	test("backup captures previous contents and restoreFromBackup restores", async () => {
		const writer = new BunFileWriter();
		const file = path.join(tmpRoot, "doc.txt");
		await Bun.write(file, "v1");

		const r = await writer.write({
			path: file,
			content: "v2",
			atomic: true,
			backup: true,
		});
		expect(await Bun.file(file).text()).toBe("v2");
		expect(r.backupPath).toBeDefined();
		expect(await Bun.file(r.backupPath!).text()).toBe("v1");

		await Bun.write(file, "corrupted");
		await restoreFromBackup(r.backupPath!, file);
		expect(await Bun.file(file).text()).toBe("v1");
	});

	test("append non-atomic appends bytes with bun-append", async () => {
		const writer = new BunFileWriter();
		const file = path.join(tmpRoot, "log.txt");
		await writer.write({
			path: file,
			content: "a",
			mode: "write",
			atomic: false,
		});
		const r = await writer.write({
			path: file,
			content: "b",
			mode: "append",
			atomic: false,
		});
		expect(r.method).toBe("bun-append");
		expect(await Bun.file(file).text()).toBe("ab");
	});

	test("append atomic reads prior content then replaces atomically", async () => {
		const writer = new BunFileWriter();
		const file = path.join(tmpRoot, "a.txt");
		await Bun.write(file, "x");
		const r = await writer.write({
			path: file,
			content: "y",
			mode: "append",
			atomic: true,
		});
		expect(r.method).toBe("bun-atomic");
		expect(await Bun.file(file).text()).toBe("xy");
	});

	test("atomic write with streaming uses bun-atomic for large payloads", async () => {
		const writer = new BunFileWriter();
		const file = path.join(tmpRoot, "streamed.txt");
		const size = 256 * 1024 + 4096;
		const content = "z".repeat(size);
		const r = await writer.write({
			path: file,
			content,
			atomic: true,
			streaming: true,
		});
		expect(r.method).toBe("bun-atomic");
		const roundtrip = await Bun.file(file).text();
		expect(roundtrip.length).toBe(size);
		expect(listTmpArtifacts().some(n => n.includes(".tmp."))).toBe(false);
	});

	test("failed atomic write removes temp file after rename fails", async () => {
		const writer = new BunFileWriter();
		const target = path.join(tmpRoot, "stable.txt");

		const renameSpy = spyOn(fsPromises, "rename").mockRejectedValueOnce(
			new Error("simulated rename failure (test)"),
		);
		try {
			await expect(writer.write({ path: target, content: "body", atomic: true })).rejects.toThrow(
				"simulated rename failure",
			);

			expect(renameSpy).toHaveBeenCalled();
			const [from, to] = renameSpy.mock.calls[0] as [string, string];
			expect(from).toContain(".tmp.");
			expect(path.dirname(from)).toBe(tmpRoot);
			expect(path.dirname(to)).toBe(tmpRoot);

			expect(fs.existsSync(target)).toBe(false);

			const tmpRemain = fs.readdirSync(tmpRoot).filter(name => name.includes(".tmp."));
			expect(tmpRemain).toEqual([]);
		} finally {
			renameSpy.mockRestore();
		}
	});

	test("benchmarkWrite runs multiple iterations and aggregates", async () => {
		const file = path.join(tmpRoot, "bench.txt");
		const agg = await benchmarkWrite(
			{
				path: file,
				content: "benchmark",
				atomic: false,
			},
			3,
		);
		expect(agg.iterations).toBe(3);
		expect(agg.results.length).toBe(3);
		expect(agg.avgWriteTime).toBeGreaterThanOrEqual(0);
		expect(Math.round(agg.avgBytesWritten)).toBe(Buffer.byteLength("benchmark", "utf8"));
	});
});

describe("registerWriteEnhancedTool", () => {
	function fakeCtx(cwd = tmpRoot): ExtensionContext {
		return { cwd } as ExtensionContext;
	}

	test("execute writes via BunFileWriter and returns details", async () => {
		let execute: (
			id: string,
			params: Record<string, unknown>,
			signal: unknown,
			onUpdate: unknown,
			ctx: ExtensionContext,
		) => Promise<import("@mariozechner/pi-coding-agent").AgentToolResult<unknown>>;

		registerWriteEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
		);

		const rel = "agent-out.txt";
		const out = await execute(
			"tid",
			{ path: rel, content: "ok", atomic: false },
			undefined,
			mock(),
			fakeCtx(tmpRoot),
		);

		expect(out.isError).toBeFalsy();
		expect((out.content?.[0] as { text: string }).text).toContain("bytesWritten");
		expect(out.details.path).toBe(rel);
		expect(out.details.method).toBe("bun-direct");
		expect(await Bun.file(path.join(tmpRoot, rel)).text()).toBe("ok");
	});

	test("executeSafe reports error when path is an existing directory", async () => {
		let execute: (...args: any[]) => any;
		registerWriteEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
		);

		fs.mkdirSync(path.join(tmpRoot, "blocked-dir"));

		const out = await execute(
			"tid",
			{ path: "blocked-dir", content: "x", atomic: false },
			undefined,
			mock(),
			fakeCtx(tmpRoot),
		);

		expect(out.isError).toBe(true);
		const msg = (out.content?.[0] as { text: string }).text ?? "";
		expect(msg.length).toBeGreaterThan(0);
	});
});
