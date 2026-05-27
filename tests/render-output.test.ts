import { describe, expect, test } from "bun:test";
import type { AgentToolResult, Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";

import { renderResult, ICONS, type ResultRenderConfig } from "../src/render-shared.ts";
import { renderLsEnhancedResult, type LsEnhancedDetails } from "../src/ls-render.ts";
import { renderShellEnhancedResult, type ShellEnhancedDetails } from "../src/shell-render.ts";

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as unknown as Theme;

function textOf(component: Component): string {
	return component.render(240).join("\n");
}

describe("human-readable tool result rendering", () => {
	test("collapsed ls_enhanced hides raw topology JSON but explains the listing", () => {
		const details: LsEnhancedDetails = {
			targetPathArg: "src",
			relRootFromWorkspace: "src",
			topologyJson: JSON.stringify({ topology: [{ name: "index.ts", relPath: "src/index.ts", kind: "file" }] }, null, 2),
			result: "legacy raw block",
			topology: [
				{ name: "index.ts", relPath: "src/index.ts", kind: "file", extension: "ts", fileCategory: "code" },
			],
			totalFiles: 1,
			totalDirectories: 0,
			scanTime: 12,
			method: "native",
			gitAware: true,
			resolvedRoot: "/repo/src",
		};

		const collapsed = textOf(renderLsEnhancedResult(
			{ content: [{ type: "text", text: details.result }], details },
			{ expanded: false } as any,
			theme,
			{} as any,
		));

		expect(collapsed).toContain("Mapped src with 1 file");
		expect(collapsed).toContain("src/index.ts .ts");
		expect(collapsed).toContain("Ctrl+O");
		expect(collapsed).not.toContain("\"topology\"");
	});

	test("expanded ls_enhanced exposes raw topology JSON", () => {
		const details: LsEnhancedDetails = {
			targetPathArg: "src",
			relRootFromWorkspace: "src",
			topologyJson: JSON.stringify({ topology: [{ name: "index.ts", relPath: "src/index.ts", kind: "file" }] }, null, 2),
			result: "legacy raw block",
			topology: [
				{ name: "index.ts", relPath: "src/index.ts", kind: "file", extension: "ts", fileCategory: "code" },
			],
			totalFiles: 1,
			totalDirectories: 0,
			scanTime: 12,
			method: "native",
			gitAware: true,
			resolvedRoot: "/repo/src",
		};

		const expanded = textOf(renderLsEnhancedResult(
			{ content: [{ type: "text", text: details.result }], details },
			{ expanded: true } as any,
			theme,
			{} as any,
		));

		expect(expanded).toContain("Raw topology JSON");
		expect(expanded).toContain("\"topology\"");
		expect(expanded).toContain("resolved root: /repo/src");
	});

	test("collapsed shell_enhanced summarizes output without raw stdout section", () => {
		const details: ShellEnhancedDetails = {
			output: [{ name: "src/index.ts", type: "file" }],
			rawOutput: "name,type\nsrc/index.ts,file",
			exitCode: 0,
			executionTime: 4,
			shell: "nu",
			structured: true,
			performance: { startupTime: 1.1, executionTime: 4.2 },
			commandPreview: "ls src",
			resolvedCwd: "/repo",
		};

		const collapsed = textOf(renderShellEnhancedResult(
			{ content: [{ type: "text", text: "raw" }], details },
			{ expanded: false } as any,
			theme,
			{} as any,
		));

		expect(collapsed).toContain("Ran command with successful exit 0");
		expect(collapsed).toContain("src/index.ts");
		expect(collapsed).not.toContain("---rawStdout---");
	});

	test("generic error rendering displays fallback content when details.result is empty", () => {
		const config: ResultRenderConfig<{ query: string; result: string }> = {
			label: "Demo",
			getQuery: d => d.query,
			getMeta: () => [],
			getIcon: () => ICONS.warning,
		};
		const result: AgentToolResult<{ query: string; result: string }> = {
			content: [{ type: "text", text: "Demo failed: permission denied" }],
			details: { query: "thing", result: "" },
			isError: true,
		};

		const rendered = textOf(renderResult(result, { expanded: false } as any, theme, config));
		expect(rendered).toContain("Demo failed: permission denied");
	});
});
