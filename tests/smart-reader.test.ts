/**
 * Smart file reader — file type detection, routing, jq/yq/bat/ast-grep integration, fallbacks.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { FileTypeDetector, astGrepLanguageForFile, type EnhancedReadResult } from "../src/read-router.ts";
import { SmartFileReader, type SmartReaderCommandRunner } from "../src/smart-reader.ts";
import { formatEnhancedReadBlock } from "../src/read-render.ts";
import { SmartReadError } from "../src/shared/errors.ts";
import { estimateTokens } from "../src/shared/utils.ts";
import { checkBinary } from "../src/shared/cli.ts";
import { withOutputTruncation } from "../src/shared/truncate.ts";

let tmpRoot: string;

function hasCmd(name: string): boolean {
	return Boolean(checkBinary(name));
}

const hasAstGrep = hasCmd("ast-grep") || hasCmd("sg");
const hasJq = hasCmd("jq");
const hasYq = hasCmd("yq");
const hasBat = hasCmd("bat");

beforeEach(() => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "smart-reader-"));
});

afterEach(() => {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("FileTypeDetector", () => {
	const d = new FileTypeDetector();

	test("detects TypeScript as code / typescript", () => {
		expect(d.detect("src/foo.ts")).toEqual({
			fileType: "code",
			codeLanguage: "typescript",
			dataFormat: undefined,
		});
	});
	test("detects TSX", () => {
		expect(d.detect("c.tsx").codeLanguage).toBe("typescript");
	});
	test("detects JavaScript", () => {
		expect(d.detect("a.js").codeLanguage).toBe("javascript");
		expect(d.detect("b.mjs").codeLanguage).toBe("javascript");
	});
	test("detects Python", () => {
		expect(d.detect("x.py").codeLanguage).toBe("python");
	});
	test("detects Rust, Go, Java", () => {
		expect(d.detect("u.rs").codeLanguage).toBe("rust");
		expect(d.detect("g.go").codeLanguage).toBe("go");
		expect(d.detect("J.java").codeLanguage).toBe("java");
	});
	test("detects C# and Kotlin", () => {
		expect(d.detect("App.cs")).toEqual({
			fileType: "code",
			codeLanguage: "csharp",
		});
		expect(d.detect("Main.kt")).toEqual({
			fileType: "code",
			codeLanguage: "kotlin",
		});
		expect(d.detect("lib.kts").codeLanguage).toBe("kotlin");
	});
	test("detects JSON as data", () => {
		const r = d.detect("p.json");
		expect(r.fileType).toBe("data");
		expect(r.dataFormat).toBe("json");
	});
	test("detects YAML as data", () => {
		expect(d.detect("a.yaml").dataFormat).toBe("yaml");
		expect(d.detect("b.yml").dataFormat).toBe("yaml");
	});
	test("detects TOML and XML as data", () => {
		expect(d.detect("t.toml").dataFormat).toBe("toml");
		expect(d.detect("x.xml").dataFormat).toBe("xml");
	});
	test("treats CSV as data", () => {
		expect(d.detect("d.csv")).toEqual({
			fileType: "data",
			dataFormat: "csv",
		});
	});
	test("treats MD as text", () => {
		expect(d.detect("r.md").fileType).toBe("text");
	});
	test("unknown extension defaults to text", () => {
		expect(d.detect("weird.unknown").fileType).toBe("text");
		expect(d.detect("noext").fileType).toBe("text");
	});
});

describe("estimateTokens", () => {
	test("uses length/4 rounding", () => {
		expect(estimateTokens("abcd")).toBe(1);
		expect(estimateTokens("")).toBe(0);
		expect(estimateTokens("a".repeat(400))).toBe(100);
	});
});

describe("SmartFileReader fallbacks (injected command runner)", () => {
	test("JSON without jq uses native JSON pretty-print", async () => {
		const file = path.join(tmpRoot, "data.json");
		const raw = '{"z":1,"a":{"b":2}}';
		fs.writeFileSync(file, raw, "utf-8");

		const runner: SmartReaderCommandRunner = {
			run: () => ({ status: 1, stdout: "", stderr: "not found" }),
		};
		const reader = new SmartFileReader({ commandRunner: runner });
		const out = await reader.read({ filePath: file, cwd: tmpRoot });

		expect(out.method).toBe("native-json");
		expect(out.content).toContain('"a"');
		expect(out.content).toContain('"b"');
		expect(out.fallbacks.some(f => f === "jq-unavailable" || f === "jq-failed")).toBe(true);
	});

	test("throws SmartReadError for missing files and directories", async () => {
		const noopRunner: SmartReaderCommandRunner = { run: () => ({ status: 127, stdout: "", stderr: "" }) };
		const reader = new SmartFileReader({ commandRunner: noopRunner });
		await expect(reader.read({ filePath: path.join(tmpRoot, "gone.txt"), cwd: tmpRoot })).rejects.toThrow(
			SmartReadError,
		);

		const subdir = fs.mkdtempSync(path.join(tmpRoot, "dir-"));
		await expect(reader.read({ filePath: subdir, cwd: tmpRoot })).rejects.toThrow(SmartReadError);
	});

	test("JSON with jq installed but jq exit non-zero uses native-json + jq-failed", async () => {
		test.skipIf(!checkBinary("jq"));
		const file = path.join(tmpRoot, "bad.json");
		fs.writeFileSync(file, "{}");
		const reader = new SmartFileReader({
			commandRunner: {
				run(cmd) {
					if (cmd === "jq") return { status: 5, stdout: "", stderr: "bad" };
					return { status: 127, stdout: "", stderr: "" };
				},
			},
		});
		const out = await reader.read({ filePath: file, cwd: tmpRoot });
		expect(out.method).toBe("native-json");
		expect(out.fallbacks).toContain("jq-failed");
		expect(out.content).toContain("{");
	});

	test("CSV uses data pipeline with native excerpt when yq fails", async () => {
		const file = path.join(tmpRoot, "rows.csv");
		fs.writeFileSync(file, 'name,score\nalice,99\nbob,42\n');
		const reader = new SmartFileReader({
			commandRunner: {
				run(cmd) {
					if (cmd === "yq") {
						return { status: 1, stdout: "", stderr: "fail" };
					}
					return { status: 127, stdout: "", stderr: "no" };
				},
			},
		});
		const out = await reader.read({ filePath: file, cwd: tmpRoot });
		expect(out.fileType).toBe("data");
		expect(out.dataFormat).toBe("csv");
		expect(out.method).toBe("native-csv-text");
		expect(out.content).toContain("name");
		expect(out.content).toContain("alice");
	});

	test("code path falls back to native when ast-grep and bat fail", async () => {
		const file = path.join(tmpRoot, "x.ts");
		fs.writeFileSync(file, "export const x = 1;\n", "utf-8");

		let calls = 0;
		const runner: SmartReaderCommandRunner = {
			run: (cmd, args) => {
				calls++;
				// fail ast-grep/sg and bat
				if (cmd.includes("grep") || cmd === "sg" || cmd === "bat") {
					return { status: 127, stdout: "", stderr: "no" };
				}
				return { status: 1, stdout: "", stderr: "no" };
			},
		};
		const reader = new SmartFileReader({ commandRunner: runner });
		const out = await reader.read({ filePath: file, cwd: tmpRoot });

		expect(out.method).toBe("native-text");
		expect(out.content).toContain("export const x");
		expect(out.fallbacks.length).toBeGreaterThan(0);
		expect(calls).toBeGreaterThan(0);
	});

	test("tracks file size and non-negative read time", async () => {
		const file = path.join(tmpRoot, "t.txt");
		const body = "hello world\n".repeat(5);
		fs.writeFileSync(file, body, "utf-8");

		const reader = new SmartFileReader({
			commandRunner: { run: () => ({ status: 127, stdout: "", stderr: "x" }) },
		});
		const out = await reader.read({ filePath: file, cwd: tmpRoot });
		expect(out.fileSizeBytes).toBe(Buffer.byteLength(body, "utf-8"));
		expect(out.readTimeMs).toBeGreaterThanOrEqual(0);
		expect(out.estimatedTokens).toBe(estimateTokens(out.content));
	});
});

describe("SmartFileReader integration (optional binaries)", () => {
	test("jq extracts JSON slice when jq is installed", async () => {
		test.skipIf(!hasJq);
		const file = path.join(tmpRoot, "pkg.json");
		fs.writeFileSync(
			file,
			JSON.stringify({ name: "x", keywords: ["a", "b"] }),
			"utf-8",
		);
		const reader = new SmartFileReader();
		const out = await reader.read({ filePath: file, cwd: tmpRoot, jqQuery: ".keywords" });
		expect(out.method).toBe("jq");
		expect(out.content).toContain("a");
		expect(out.fallbacks.length).toBe(0);
	});

	test("yq reads YAML when yq is installed", async () => {
		test.skipIf(!hasYq);
		const file = path.join(tmpRoot, "c.yaml");
		fs.writeFileSync(file, "foo:\n  bar: 42\n", "utf-8");
		const reader = new SmartFileReader();
		const out = await reader.read({ filePath: file, cwd: tmpRoot, yqQuery: ".foo.bar" });
		expect(out.content).toContain("42");
		if (["yq-mikefarah", "yq-other"].includes(out.method)) {
			expect(out.fallbacks.length).toBe(0);
		} else {
			expect(out.method).toBe("native-yaml-text");
			expect(out.fallbacks.some(f => f.startsWith("yq-"))).toBe(true);
		}
	});

	test("ast-grep produces skeleton for TS when installed", async () => {
		test.skipIf(!hasAstGrep);
		const file = path.join(tmpRoot, "s.ts");
		fs.writeFileSync(
			file,
			[
				"export function hello(a: number, b: string): boolean {",
				"  return a > 0;",
				"}",
				"export class Foo {",
				"  run() {}",
				"}",
				"",
			].join("\n"),
			"utf-8",
		);
		const reader = new SmartFileReader();
		const out = await reader.read({ filePath: file, cwd: tmpRoot });

		expect(out.method).toBe("ast-grep");
		expect(out.fileType).toBe("code");
		expect(out.codeLanguage).toBe("typescript");
		expect(out.content).toContain("hello");
		expect(out.content).toContain("Foo");
	});

	test("bat highlights text when bat is installed", async () => {
		test.skipIf(!hasBat);
		const file = path.join(tmpRoot, "n.txt");
		fs.writeFileSync(file, "line1\nline2\n", "utf-8");
		const reader = new SmartFileReader();
		const out = await reader.read({ filePath: file, cwd: tmpRoot });
		expect(out.method).toBe("bat");
		expect(out.content.length).toBeGreaterThan(0);
	});

	test("Python file gets ast-grep skeleton when installed", async () => {
		test.skipIf(!hasAstGrep);
		const file = path.join(tmpRoot, "m.py");
		fs.writeFileSync(file, "def foo(a, b):\n    pass\n\nclass Bar:\n    pass\n");
		const reader = new SmartFileReader();
		const out = await reader.read({ filePath: file, cwd: tmpRoot });
		expect(out.method).toBe("ast-grep");
		expect(out.codeLanguage).toBe("python");
		expect(out.content).toContain("foo");
	});
});

describe("formatEnhancedReadBlock and tool-style truncation", () => {
	test("serializes metadata, fallbacks, then body after separator", () => {
		const stub: EnhancedReadResult = {
			content: "payload",
			method: "jq",
			fileType: "data",
			dataFormat: "json",
			estimatedTokens: 2,
			readTimeMs: 3,
			fileSizeBytes: 9,
			fallbacks: ["jq-failed"],
		};
		const blob = formatEnhancedReadBlock(stub, "cfg.json");
		expect(blob).toContain("path: cfg.json");
		expect(blob).toContain("method: jq");
		expect(blob).toContain("fileType: data");
		expect(blob).toContain("dataFormat: json");
		expect(blob).toContain("fallbacks: jq-failed");
		expect(blob).toContain("\n---\npayload");
	});

	test("withOutputTruncation trims formatEnhancedReadBlock output", () => {
		const lines = "x\n".repeat(300);
		const stub: EnhancedReadResult = {
			content: lines,
			method: "bat",
			fileType: "text",
			estimatedTokens: 999,
			readTimeMs: 0,
			fileSizeBytes: Buffer.byteLength(lines, "utf-8"),
			fallbacks: [],
		};
		const text = formatEnhancedReadBlock(stub, "wide.log");
		const wrapped = withOutputTruncation(
			{
				text,
				details: {
					path: "wide.log",
					method: "bat",
					fileType: "text",
					estimatedTokens: stub.estimatedTokens,
					readTimeMs: 0,
					fileSizeBytes: stub.fileSizeBytes,
					fallbacks: [],
					result: text,
				},
			},
			600,
			80,
		);
		expect(wrapped.text.length).toBeLessThan(text.length);
		expect(wrapped.text).toContain("(truncated");
	});
});

describe("astGrepLanguageForFile", () => {
	test("maps path + CodeLanguage to ast-grep `-l`", () => {
		expect(astGrepLanguageForFile("x.ts", "typescript")).toBe("ts");
		expect(astGrepLanguageForFile("x.tsx", "typescript")).toBe("tsx");
		expect(astGrepLanguageForFile("a.js", "javascript")).toBe("js");
		expect(astGrepLanguageForFile("b.jsx", "javascript")).toBe("jsx");
		expect(astGrepLanguageForFile("m.py", "python")).toBe("py");
		expect(astGrepLanguageForFile("lib.rs", "rust")).toBe("rust");
		expect(astGrepLanguageForFile("main.go", "go")).toBe("go");
		expect(astGrepLanguageForFile("App.java", "java")).toBe("java");
		expect(astGrepLanguageForFile("lib.cs", "csharp")).toBe("csharp");
		expect(astGrepLanguageForFile("x.kt", "kotlin")).toBe("kotlin");
		expect(astGrepLanguageForFile("x.ts", "other")).toBeUndefined();
	});
});
