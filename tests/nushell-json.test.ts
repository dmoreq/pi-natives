/**
 * `NushellJsonExecutor` — pipeline enhancement, parsing, fallback chain (mocked), timeouts.
 */
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
	NushellJsonExecutor,
	createDefaultShellDeps,
	enforceJsonPipeline,
	isStructurableCommand,
	parseNushellTable,
	runBunShellViaBunDollar,
	type ShellBackendRunResult,
	type ShellDeps,
} from "../src/nushell-json.ts";
import { registerShellEnhancedTool } from "../src/tools/shell-enhanced.ts";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

describe("enforceJsonPipeline + isStructurableCommand", () => {
	test("detects ls / env / pwd / ps / git log / git status", () => {
		expect(isStructurableCommand("ls")).toBe(true);
		expect(isStructurableCommand("ls -la src")).toBe(true);
		expect(isStructurableCommand("env")).toBe(true);
		expect(isStructurableCommand("pwd")).toBe(true);
		expect(isStructurableCommand("ps")).toBe(true);
		expect(isStructurableCommand("git log -n 3")).toBe(true);
		expect(isStructurableCommand("git status")).toBe(true);
		expect(isStructurableCommand("echo hello")).toBe(false);
	});

	test("inject ls pipeline", () => {
		expect(enforceJsonPipeline("ls").enhanced).toBe(true);
		expect(enforceJsonPipeline("ls").nuScript).toContain("to json");
		expect(enforceJsonPipeline("ls").nuScript).toContain("|");
	});

	test("inject env pipeline", () => {
		const { nuScript, enhanced } = enforceJsonPipeline("env");
		expect(enhanced).toBe(true);
		expect(nuScript).toContain("$env");
		expect(nuScript).toContain("to json");
	});

	test("inject git log pipeline preserves args and adds format=json when absent", () => {
		const { nuScript } = enforceJsonPipeline("git log -n 2 --oneline");
		expect(nuScript).toContain("--format=json");
		expect(nuScript).toContain("from json");
		expect(nuScript).toContain("to json");
	});

	test("inject ps pipeline", () => {
		const { nuScript, enhanced } = enforceJsonPipeline("ps aux");
		expect(enhanced).toBe(true);
		expect(nuScript).toContain("select pid name cpu mem");
		expect(nuScript).toContain("to json");
	});

	test("inject git status pipeline with porcelain", () => {
		const { nuScript, enhanced } = enforceJsonPipeline("git status");
		expect(enhanced).toBe(true);
		expect(nuScript).toContain("--porcelain=v1");
		expect(nuScript).toContain("status_xy");
		expect(nuScript).toContain("to json");
	});
});

describe("parseNushellTable", () => {
	test("parses simple nu-style ascii table rows", () => {
		const text = [
			"───┬───────┬────────",
			" # │ name  │ size  ",
			"───┼───────┼────────",
			" 0 │ a.txt │   12 B",
			" 1 │ b.txt │    8 B",
			"───┴───────┴────────",
		].join("\n");

		const rows = parseNushellTable(text);
		expect(rows.length).toBe(2);
		expect(rows[0]?.name ?? rows[0]?.["name"]).toBe("a.txt");
	});
});

describe("NushellJsonExecutor fallback chain", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nu-json-"));
	});

	afterEach(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	function depsSequence(
		sequence: Array<{ shell: "nushell" | "bun" | "bash"; ok: ShellBackendRunResult }>,
	): ShellDeps {
		let i = 0;
		return {
			whichNu: () => "/fake/nu",
			runNu: async (_exe, _script, _opts) => {
				const step = sequence[i++];
				expect(step.shell).toBe("nushell");
				return step.ok;
			},
			runBunShell: async (_cmd, _opts) => {
				const step = sequence[i++];
				expect(step.shell).toBe("bun");
				return step.ok;
			},
			runBash: async (_cmd, _opts) => {
				const step = sequence[i++];
				expect(step.shell).toBe("bash");
				return step.ok;
			},
		};
	}

	test("structured JSON when nushell returns valid stdout", async () => {
		const exe = new NushellJsonExecutor({
			deps: depsSequence([
				{
					shell: "nushell",
					ok: {
						code: 0,
						stdout: '[{"x":1}]\n',
						stderr: "",
						startupMs: 1,
						executionMs: 10,
					},
				},
			]),
			fallbackToBunDefault: true,
		});

		const r = await exe.execute({
			command: "ls",
			enforceJson: true,
			cwd: tmp,
			fallbackToBun: true,
		});
		expect(r.shell).toBe("nushell");
		expect(r.structured).toBe(true);
		expect(r.exitCode).toBe(0);
		expect(Array.isArray(r.output)).toBe(true);
		expect(r.output[0]).toEqual({ x: 1 });
		expect(r.performance.startupTime).toBe(1);
		expect(r.performance.executionTime).toBe(10);
	});

	test("nushell: non-JSON stdout but parseable nu table stays on nushell (structured)", async () => {
		const tableOut = [
			"───┬───────┬────────",
			" # │ name  │ size  ",
			"───┼───────┼────────",
			" 0 │ a.txt │   12 B",
			" 1 │ b.txt │    8 B",
			"───┴───────┴────────",
		].join("\n");
		const exe = new NushellJsonExecutor({
			deps: depsSequence([
				{
					shell: "nushell",
					ok: {
						code: 0,
						stdout: `${tableOut}\n`,
						stderr: "",
						startupMs: 2,
						executionMs: 3,
					},
				},
			]),
		});

		const r = await exe.execute({
			command: "ls",
			enforceJson: true,
			cwd: tmp,
			fallbackToBun: true,
		});
		expect(r.shell).toBe("nushell");
		expect(r.structured).toBe(true);
		expect(Array.isArray(r.output)).toBe(true);
		expect(r.exitCode).toBe(0);
	});

	test("nushell: neither JSON nor table → bun fallback when allowed", async () => {
		const exe = new NushellJsonExecutor({
			deps: depsSequence([
				{
					shell: "nushell",
					ok: {
						code: 0,
						stdout: "plain text output\n",
						stderr: "",
						startupMs: 2,
						executionMs: 3,
					},
				},
				{
					shell: "bun",
					ok: {
						code: 0,
						stdout: "raw-bun-out\n",
						stderr: "",
						startupMs: 1,
						executionMs: 4,
					},
				},
			]),
		});

		const r = await exe.execute({
			command: "ls",
			enforceJson: true,
			cwd: tmp,
			fallbackToBun: true,
		});
		expect(r.shell).toBe("bun");
		expect(r.structured).toBe(false);
		expect(r.rawOutput).toContain("raw-bun-out");
		expect(r.exitCode).toBe(0);
	});

	test("full chain: nu fails → bun fails → bash succeeds", async () => {
		const exe = new NushellJsonExecutor({
			deps: depsSequence([
				{
					shell: "nushell",
					ok: {
						code: 1,
						stdout: "",
						stderr: "nu nope",
						startupMs: 1,
						executionMs: 2,
					},
				},
				{
					shell: "bun",
					ok: {
						code: 2,
						stdout: "",
						stderr: "bun nope",
						startupMs: 1,
						executionMs: 2,
					},
				},
				{
					shell: "bash",
					ok: {
						code: 0,
						stdout: "bash-ok\n",
						stderr: "",
						startupMs: 1,
						executionMs: 3,
					},
				},
			]),
		});

		const r = await exe.execute({
			command: "ls",
			enforceJson: true,
			cwd: tmp,
			fallbackToBun: true,
		});
		expect(r.shell).toBe("bash");
		expect(r.exitCode).toBe(0);
		expect(r.rawOutput).toContain("bash-ok");
	});

	test("nushell exit non-zero triggers bun tier when bun succeeds", async () => {
		const exe = new NushellJsonExecutor({
			deps: depsSequence([
				{
					shell: "nushell",
					ok: {
						code: 1,
						stdout: "oops",
						stderr: "err",
						startupMs: 1,
						executionMs: 2,
					},
				},
				{
					shell: "bun",
					ok: {
						code: 0,
						stdout: "from-bun-tier\n",
						stderr: "",
						startupMs: 0,
						executionMs: 5,
					},
				},
			]),
		});

		const r = await exe.execute({
			command: "ls",
			enforceJson: true,
			fallbackToBun: true,
			cwd: tmp,
		});
		expect(r.shell).toBe("bun");
		expect(r.exitCode).toBe(0);
		expect(r.rawOutput).toContain("from-bun-tier");
	});

	test("without nu path uses bun before bash when fallbackToBun", async () => {
		const exe = new NushellJsonExecutor({
			deps: {
				whichNu: () => null,
				runNu: async (_a, _b, _c) => {
					throw new Error("nu should not run");
				},
				runBunShell: async () => ({
					code: 0,
					stdout: "posix raw\n",
					stderr: "",
					startupMs: 2,
					executionMs: 8,
				}),
				runBash: async () => {
					throw new Error("bash should not run when bun succeeds");
				},
			},
		});

		const r = await exe.execute({
			command: "echo hello",
			cwd: tmp,
			fallbackToBun: true,
			enforceJson: false,
		});
		expect(r.shell).toBe("bun");
		expect(r.rawOutput.trim()).toBe("posix raw");
	});

	test("without nu and bun disabled uses bash", async () => {
		const exe = new NushellJsonExecutor({
			deps: {
				whichNu: () => null,
				runNu: async (_a, _b, _c) => {
					throw new Error("unexpected");
				},
				runBunShell: async () => ({
					code: 0,
					stdout: "should-not-be-used-when-disabled",
					stderr: "",
					startupMs: 1,
					executionMs: 2,
				}),
				runBash: async () => ({
					code: 7,
					stdout: "bash-out\n",
					stderr: "",
					startupMs: 3,
					executionMs: 11,
				}),
			},
		});

		const r = await exe.execute({
			command: 'printf "x"',
			fallbackToBun: false,
			enforceJson: false,
			cwd: tmp,
		});
		expect(r.shell).toBe("bash");
		expect(r.exitCode).toBe(7);
		expect(r.rawOutput).toBe("bash-out\n");
	});

	test("timeout returns error-ish result via killed process", async () => {
		const exe = new NushellJsonExecutor({
			deps: {
				whichNu: () => "/nu",
				runNu: async (_nu, _script, _opts) => ({
					code: 124,
					stdout: "",
					stderr: "timeout",
					startupMs: 0,
					executionMs: 55,
				}),
				runBunShell: async () => ({
					code: 0,
					stdout: "late",
					stderr: "",
					startupMs: 0,
					executionMs: 2,
				}),
				runBash: async () => ({
					code: 0,
					stdout: "",
					stderr: "",
					startupMs: 0,
					executionMs: 0,
				}),
			},
		});

		const r = await exe.execute({
			command: "sleep 999",
			timeout: 1,
			cwd: tmp,
			fallbackToBun: true,
			enforceJson: false,
		});
		expect(r.shell).toBe("bun");
		expect(r.performance.executionTime >= 0).toBe(true);
	});
});

describe("runBunShellViaBunDollar Bun dollar shell tier", () => {
	test("runs user command fragments through the Bun shell", async () => {
		const r = await runBunShellViaBunDollar(
			"echo bun-dollar-test",
			{},
		);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("bun-dollar-test");
	});
});

describe("POSIX bash tier: real AbortSignal timeout", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bash-timeout-"));
	});

	afterEach(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	test.skipIf(process.platform === "win32")(
		"bash subprocess is aborted quickly on long-running sleep when nu is unavailable",
		async () => {
			const defaults = createDefaultShellDeps();
			const exe = new NushellJsonExecutor({
				deps: {
					whichNu: () => null,
					runNu: defaults.runNu,
					runBunShell: defaults.runBunShell,
					runBash: defaults.runBash,
				},
			});
			const t0 = Date.now();
			const r = await exe.execute({
				command: "sleep 45",
				enforceJson: false,
				timeout: 550,
				cwd: tmp,
				fallbackToBun: false,
			});
			expect(Date.now() - t0).toBeLessThan(9000);
			expect(r.shell).toBe("bash");
			// macOS/Linux may surface SIGTERM as 143 (128+15) rather than synthetic 124
			expect([124, 143]).toContain(r.exitCode);
		},
	);
});

describe("AbortSignal propagation", () => {
	test("already-aborted signal short-circuits bunSpawnCollect inside runBash", async () => {
		const ctl = new AbortController();
		ctl.abort(new DOMException("agent cancelled", "AbortError"));

		let bashDelegated = 0;
		const exe = new NushellJsonExecutor({
			deps: {
				whichNu: () => null,
				runNu: async () => ({
					code: 0,
					stdout: "",
					stderr: "",
					startupMs: 0,
					executionMs: 0,
				}),
				runBunShell: async () => ({
					code: 0,
					stdout: "",
					stderr: "",
					startupMs: 0,
					executionMs: 0,
				}),
				runBash: async (_cmd, opts) => {
					bashDelegated++;
					return createDefaultShellDeps().runBash("true", opts);
				},
			},
		});

		const r = await exe.execute({
			command: "sleep 999",
			fallbackToBun: false,
			signal: ctl.signal,
		});

		expect(bashDelegated).toBe(1);
		expect(r.exitCode).toBe(125);
		expect(r.shell).toBe("bash");
		expect(r.rawOutput).toBe("");
	});
});

describe("registerShellEnhancedTool", () => {
	let tmp: string;
	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shell-tool-"));
	});
	afterEach(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	test("integration: execute resolves cwd and delegates to executor", async () => {
		let execute!: (
			id: string,
			params: { command: string; cwd?: string },
			signal: AbortSignal | undefined,
			onUpdate: unknown,
			ctx: ExtensionContext,
		) => Promise<unknown>;

		const deps: ShellDeps = {
			whichNu: () => "/nu",
			runNu: async (_nu, _script, _opts) => ({
				code: 0,
				stdout: '{"ok":true}',
				stderr: "",
				startupMs: 1,
				executionMs: 4,
			}),
			runBunShell: async (_c, _o) => ({
				code: 0,
				stdout: "",
				stderr: "",
				startupMs: 0,
				executionMs: 0,
			}),
			runBash: async (_c, _o) => ({
				code: 0,
				stdout: "",
				stderr: "",
				startupMs: 0,
				executionMs: 0,
			}),
		};

		registerShellEnhancedTool(
			{
				registerTool(opts: Record<string, unknown>) {
					execute = opts.execute as typeof execute;
				},
			} as unknown as ExtensionAPI,
			"doc",
			{ executorFactory: () => new NushellJsonExecutor({ deps }) },
		);

		const out = await execute("tid", { command: "env" }, undefined, mock(), {
			cwd: tmp,
		} as ExtensionContext);

		expect(out.isError).toBeFalsy();
		expect((out.details as any).resolvedCwd).toBe(tmp);
		expect((out.details as any).structured).toBe(true);
		const text = (out.content?.[0] as { text: string }).text ?? "";
		expect(text).toContain("shell: nushell");
	});
});
