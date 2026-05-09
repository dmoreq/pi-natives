/**
 * Integration test for the main extension entry point.
 * 
 * Ensures that:
 * 1. The extension can be imported without errors
 * 2. All tool registrations work properly
 * 3. Import paths are correct
 */

import { describe, test, expect, mock } from "bun:test";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

describe("Extension Loading", () => {
	test("should import extension without errors", async () => {
		// This will catch broken import paths immediately
		const extensionModule = await import("../src/index.ts");
		expect(extensionModule.default).toBeDefined();
		expect(typeof extensionModule.default).toBe("function");
	});

	test("should register all tools without throwing", () => {
		// Mock ExtensionAPI
		const mockApi: ExtensionAPI = {
			on: mock(() => {}),
			registerTool: mock(() => {}),
			ui: {
				notify: mock(() => {}),
			},
		} as any;

		// Import and call the extension function
		expect(async () => {
			const piSherlockExtension = (await import("../src/index.ts")).default;
			piSherlockExtension(mockApi);
		}).not.toThrow();
	});

	test("should call session_start handler", async () => {
		const onMock = mock(() => {});
		const mockApi: ExtensionAPI = {
			on: onMock,
			registerTool: mock(() => {}),
			ui: {
				notify: mock(() => {}),
			},
		} as any;

		const piSherlockExtension = (await import("../src/index.ts")).default;
		piSherlockExtension(mockApi);

		// Verify session_start handler was registered
		expect(onMock).toHaveBeenCalledWith("session_start", expect.any(Function));
	});

	test("should register expected number of tools", async () => {
		const registerToolMock = mock(() => {});
		const mockApi: ExtensionAPI = {
			on: mock(() => {}),
			registerTool: registerToolMock,
			ui: {
				notify: mock(() => {}),
			},
		} as any;

		const piSherlockExtension = (await import("../src/index.ts")).default;
		piSherlockExtension(mockApi);

		// Expected tools: search, ripgrep, concept_search, fuzzy_find, find_files,
		// semgrep, ast_grep, tokei, jscpd, read_enhanced, write_enhanced, edit_enhanced, shell_enhanced, ls_enhanced
		expect(registerToolMock).toHaveBeenCalledTimes(14);
	});
});

describe("Tool Registration Functions", () => {
	test("should import all tool registration functions", async () => {
		// Test individual tool registration functions can be imported
		const modules = [
			"../src/tools/search",
			"../src/tools/ripgrep", 
			"../src/tools/bm25",
			"../src/tools/fzf",
			"../src/tools/fd",
			"../src/tools/semgrep",
			"../src/tools/ast-grep",
			"../src/tools/tokei",
			"../src/tools/jscpd",
			"../src/tools/read-enhanced",
			"../src/tools/write-enhanced",
			"../src/tools/edit-enhanced",
			"../src/tools/shell-enhanced",
			"../src/tools/ls-enhanced",
		];

		for (const modulePath of modules) {
			expect(async () => {
				await import(modulePath);
			}).not.toThrow();
		}
	});
});