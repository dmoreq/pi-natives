import { describe, test, expect } from "bun:test";
import {
	PromptBuilder,
	GUIDELINES_CONFIG,
	REQUIRED_GUIDELINE_TOOL_NAMES,
	missingGuidelineTools,
	type ToolGuidelineEntry,
} from "../../src/routing/prompt-builder";
import type { PiSherlockToolName } from "../../src/routing/types";

describe("PromptBuilder", () => {
	test("buildGuidelines produces Primary, Use when, Avoid, CRITICAL, Example prefixes in order", () => {
		const config: ToolGuidelineEntry = {
			primaryUse: "Test primary",
			triggers: ["a", "b"],
			avoid: ["x"],
			critical: ["rule"],
			examples: ["ex1"],
		};

		const g = PromptBuilder.buildGuidelines("fixture", config);

		expect(g).toHaveLength(1 + 2 + 1 + 1 + 1);
		expect(g[0]).toBe("Primary: Test primary");
		expect(g[1]).toBe("Use when: a");
		expect(g[2]).toBe("Use when: b");
		expect(g[3]).toBe("Avoid: x");
		expect(g[4]).toBe("CRITICAL: rule");
		expect(g[5]).toBe("Example: ex1");
	});

	test("guidelines-config.json defines every REQUIRED_GUIDELINE_TOOL_NAMES entry", () => {
		expect(missingGuidelineTools()).toEqual([]);
		for (const name of REQUIRED_GUIDELINE_TOOL_NAMES) {
			const entry = GUIDELINES_CONFIG.tools[name];
			expect(entry, `missing tool ${name}`).toBeDefined();
			expect(typeof entry!.primaryUse).toBe("string");
			expect(entry!.primaryUse.length).toBeGreaterThan(0);
			expect(entry!.triggers.length).toBeGreaterThan(0);
			expect(entry!.avoid.length).toBeGreaterThan(0);
			expect(entry!.critical.length).toBeGreaterThan(0);
			expect(entry!.examples.length).toBeGreaterThan(0);
		}
	});

	test("guidelines-config has no stray tool keys outside the Pi sherlock union", () => {
		const allowed = new Set<string>(REQUIRED_GUIDELINE_TOOL_NAMES);
		const keys = Object.keys(GUIDELINES_CONFIG.tools);
		for (const k of keys) {
			expect(allowed.has(k), `unexpected tool key "${k}"`).toBe(true);
		}
		expect(keys.length).toBe(REQUIRED_GUIDELINE_TOOL_NAMES.length);
	});

	test("guidelinesFor matches buildGuidelines for each tool name", () => {
		for (const name of REQUIRED_GUIDELINE_TOOL_NAMES) {
			const entry = GUIDELINES_CONFIG.tools[name]!;
			const fromFor = PromptBuilder.guidelinesFor(name as PiSherlockToolName);
			const fromRaw = PromptBuilder.buildGuidelines(name, entry);
			expect(fromFor).toEqual(fromRaw);
		}
	});

	test("search guidelines mention default content-search policy", () => {
		const lines = PromptBuilder.guidelinesFor("search");
		const joined = lines.join("\n");
		expect(joined).toContain("grep");
		expect(joined).toContain("concept_search");
		expect(joined).toContain("ripgrep");
	});

	test("semgrep vs ast_grep divergence is spelled out without contradiction", () => {
		const sem = PromptBuilder.guidelinesFor("semgrep").join("\n");
		const ast = PromptBuilder.guidelinesFor("ast_grep").join("\n");
		expect(sem).toMatch(/ast_grep/i);
		expect(ast).toMatch(/semgrep/i);
	});
});
