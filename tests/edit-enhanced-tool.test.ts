/**
 * `edit_enhanced` tool registration — mock ExtensionAPI + execute path.
 */
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { AstFileEditor } from "../src/ast-editor.ts";
import { registerEditEnhancedTool } from "../src/tools/edit-enhanced.ts";

describe("registerEditEnhancedTool", () => {
	let tmpRoot: string;

	function fakeCtx(cwd = tmpRoot): ExtensionContext {
		return { cwd } as ExtensionContext;
	}

	beforeEach(async () => {
		const root = path.resolve(import.meta.dir, "..");
		tmpRoot = await fs.mkdtemp(path.join(root, "tmp-edit-tool-"));
	});

	afterEach(async () => {
		await fs.rm(tmpRoot, { recursive: true, force: true });
	});

	test("execute performs native edit via mock ExtensionAPI", async () => {
		let execute: (
			id: string,
			params: Record<string, unknown>,
			signal: unknown,
			onUpdate: unknown,
			ctx: ExtensionContext,
		) => Promise<import("@mariozechner/pi-coding-agent").AgentToolResult<unknown>>;

		registerEditEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
		);

		const rel = "note.md";
		await fs.writeFile(path.join(tmpRoot, rel), "OLD\n", "utf8");
		const out = await execute("tid", { path: rel, pattern: "OLD", replacement: "NEW", backup: false }, undefined, mock(), fakeCtx());

		expect(out.isError).toBeFalsy();
		expect(out.details.method).toBe("native-string");
		expect(out.details.totalChanges).toBe(1);
		expect(String((out.content?.[0] as { text: string }).text)).toContain("syntax_ok");
		expect(await fs.readFile(path.join(tmpRoot, rel), "utf8")).toBe("NEW\n");
	});

	test("execute surfaces reserved-scope warnings in text + details", async () => {
		let execute: (...args: any[]) => any;
		registerEditEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
		);

		const rel = "scoped.md";
		await fs.writeFile(path.join(tmpRoot, rel), "x\n", "utf8");
		const out = await execute(
			"tid",
			{ path: rel, pattern: "x", replacement: "y", scope: "class", backup: false },
			undefined,
			mock(),
			fakeCtx(),
		);

		expect(out.isError).toBeFalsy();
		expect(out.details.warnings?.length).toBeGreaterThan(0);
		expect(String((out.content?.[0] as { text: string }).text)).toContain("warnings:");
		expect(await fs.readFile(path.join(tmpRoot, rel), "utf8")).toBe("y\n");
	});

	test("execute returns isError for missing targets", async () => {
		let execute: (...args: any[]) => any;
		registerEditEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
		);

		const out = await execute(
			"tid",
			{ path: "_missing_pi_edit_.md", pattern: "a", replacement: "b", backup: false },
			undefined,
			mock(),
			fakeCtx(),
		);

		expect(out.isError).toBe(true);
		const msg = String((out.content?.[0] as { text: string }).text ?? "");
		expect(msg).toContain("File not found:");
	});

	test("execute forwards ast-grep spawn failures via injected editor", async () => {
		let execute: (...args: any[]) => any;
		const failingEditor = new AstFileEditor({
			astGrepCommand: "/___nonexistent___/bin/sg",
		});

		registerEditEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
			{ editor: failingEditor },
		);

		const rel = "code.ts";
		await fs.writeFile(path.join(tmpRoot, rel), "const x = 1;\n", "utf8");

		const out = await execute(
			"tid",
			{
				path: rel,
				pattern: "const $V = $EXPR",
				replacement: "let $V = $EXPR",
				preview: true,
				backup: false,
			},
			undefined,
			mock(),
			fakeCtx(),
		);

		expect(out.isError).toBe(true);
		expect(String((out.content?.[0] as { text: string }).text)).toMatch(/failed to start|ast-grep/i);
	});
});
