/**
 * `read_enhanced` tool — execute/error paths with injectable SmartFileReader.
 */
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { registerReadEnhancedTool } from "../src/tools/read-enhanced.ts";
import { SmartFileReader, type SmartReaderCommandRunner } from "../src/smart-reader.ts";
import { checkBinary } from "../src/shared/cli.ts";

let tmpRoot: string;

beforeEach(() => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "read-enhanced-"));
});

afterEach(() => {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function fakeCtx(cwd = tmpRoot): ExtensionContext {
	return { cwd } as ExtensionContext;
}

describe("registerReadEnhancedTool execute", () => {
	test("executeSafe surfaces SmartReadError for missing file", async () => {
		let execute: (
			id: string,
			params: { path: string },
			signal: unknown,
			onUpdate: unknown,
			ctx: ExtensionContext,
		) => Promise<import("@mariozechner/pi-coding-agent").AgentToolResult<unknown>>;
		registerReadEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
		);

		const out = await execute("tid", { path: "definitely-absent.bin" }, undefined, mock(), fakeCtx(tmpRoot));

		expect(out.isError).toBe(true);
		const msg =
			Array.isArray(out.content) &&
			out.content[0]?.type === "text" &&
			(out.content[0] as { text: string }).text;
		expect(msg).toContain("Not a file or missing");
		expect(out.details.path).toBe("definitely-absent.bin");
	});

	test("json falls back after jq exits non-zero when jq is installed (injected failing runner)", async () => {
		test.skipIf(!checkBinary("jq"));

		const file = path.join(tmpRoot, "x.json");
		fs.writeFileSync(file, '{"k":42}', "utf-8");

		const jqRunner: SmartReaderCommandRunner = {
			run(cmd) {
				if (cmd === "jq") return { status: 2, stdout: "", stderr: "invalid" };
				return { status: 127, stdout: "", stderr: "no" };
			},
		};
		const reader = new SmartFileReader({ commandRunner: jqRunner });

		let execute: (...args: any[]) => any;
		registerReadEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
			{ reader },
		);

		const out = await execute(
			"tid",
			{ path: path.basename(file), jqQuery: ".k" },
			undefined,
			mock(),
			fakeCtx(tmpRoot),
		);

		expect(out.isError).toBeFalsy();
		const body = (out.content?.[0] as { text: string }).text ?? "";
		expect(body).toContain("42");
		expect(body).toContain("jq-failed");
		expect(out.details.method).toBe("native-json");
	});
});
