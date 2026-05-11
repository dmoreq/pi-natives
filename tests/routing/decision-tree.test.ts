import { describe, expect, test } from "bun:test";
import {
	BUNDLED_TREE_CONFIG,
	DecisionTree,
	collectTreeTools,
	parseTreeConfig,
	type TreeTraversalResult,
} from "../../src/routing/decision-tree";
import type { PiSherlockToolName, ToolContext } from "../../src/routing/types";
import { allBinariesAvailableSnapshot } from "./test-helpers";

const ALL_TOOLS: readonly PiSherlockToolName[] = [
	"search",
	"concept_search",
	"find_files",
	"fuzzy_find",
	"ripgrep",
	"semgrep",
	"ast_grep",
	"count_lines",
	"find_duplicates",
	"read_enhanced",
	"write_enhanced",
	"edit_enhanced",
	"shell_enhanced",
	"ls_enhanced",
] as const;

function ctx(partial: Partial<ToolContext> & Pick<ToolContext, "intent">): ToolContext {
	const base: ToolContext = {
		intent: partial.intent,
		specificity: partial.specificity ?? "exact",
		scope: partial.scope ?? "content",
		hasPattern: partial.hasPattern ?? false,
		patternType: partial.patternType,
		features: partial.features,
		fileContext: partial.fileContext,
		binaryAvailability: partial.binaryAvailability ?? allBinariesAvailableSnapshot(),
		performancePreference: partial.performancePreference ?? "token_efficiency",
	};
	return base;
}

function expectLeaf(
	tree: DecisionTree,
	partial: Partial<ToolContext> & Pick<ToolContext, "intent">,
	tool: PiSherlockToolName,
	extra?: (r: TreeTraversalResult) => void,
): void {
	const r = tree.traverse(ctx(partial));
	expect(r.tool).toBe(tool);
	expect(r.confidence).toBeGreaterThan(0.5);
	expect(r.path.length).toBeGreaterThan(0);
	extra?.(r);
}

describe("DecisionTree configuration", () => {
	test("bundled tree parses and lists exactly the 14 pi-sherlock tools", () => {
		expect(BUNDLED_TREE_CONFIG.version).toBe(1);
		const configured = collectTreeTools(BUNDLED_TREE_CONFIG.root);
		expect(configured).toHaveLength(ALL_TOOLS.length);
		for (const name of ALL_TOOLS) {
			expect(configured.includes(name)).toBe(true);
		}
	});

	test("parseTreeConfig rejects invalid payloads", () => {
		expect(() => parseTreeConfig(null)).toThrow(/Invalid decision tree configuration/);
		expect(() => parseTreeConfig({ version: 2 })).toThrow(/Invalid decision tree configuration/);
	});

	test("throws when an option lacks both leaf and branch", () => {
		const bad = parseTreeConfig({
			version: 1,
			root: {
				id: "root",
				branches: [{ id: "broken", priority: 5, match: { intent: "list" as const } }],
				defaultLeaf: { tool: "ls_enhanced", baseConfidence: 0.5 },
			},
		});
		const tree = new DecisionTree(bad);
		expect(() => tree.traverse(ctx({ intent: "list" }))).toThrow(/must define leaf or branch/);
	});

	test("throws on dead-end branch without defaultLeaf", () => {
		const bad = parseTreeConfig({
			version: 1,
			root: {
				id: "root",
				branches: [{ id: "never_matches", priority: 9, match: { intent: "shell" as const } }],
			},
		});
		const tree = new DecisionTree(bad);
		expect(() => tree.traverse(ctx({ intent: "analyze" }))).toThrow(/dead-end/);
	});
});

describe("DecisionTree traversal — all fourteen tools reachable", () => {
	const tree = new DecisionTree();

	test("duplicate detection signals → find_duplicates", () => {
		expectLeaf(
			tree,
			{ intent: "search", features: ["duplicate-detection"], specificity: "conceptual", scope: "content" },
			"find_duplicates",
			(r) => expect(r.path[0]).toBe("dup_signal"),
		);
	});

	test("intent refactor → find_duplicates", () => {
		expectLeaf(tree, { intent: "refactor", specificity: "structural", scope: "structure" }, "find_duplicates");
	});

	test("intent count → count_lines", () => {
		expectLeaf(tree, { intent: "count", scope: "metrics" }, "count_lines");
	});

	test("intent analyze + security → semgrep", () => {
		expectLeaf(tree, { intent: "analyze", features: ["security-audit"], scope: "structure" }, "semgrep");
	});

	test("intent analyze + ast pattern → ast_grep", () => {
		expectLeaf(
			tree,
			{ intent: "analyze", patternType: "ast", specificity: "structural", scope: "structure" },
			"ast_grep",
			(r) => expect(r.path).toContain("analyze_ast_pattern"),
		);
	});

	test("intent analyze + structural specificity (no security) → ast_grep", () => {
		expectLeaf(
			tree,
			{ intent: "analyze", specificity: "structural", scope: "structure" },
			"ast_grep",
			(r) => expect(r.path).toContain("analyze_structural_specificity"),
		);
	});

	test("intent analyze default → ast_grep", () => {
		expectLeaf(tree, { intent: "analyze", scope: "structure" }, "ast_grep", (r) =>
			expect(r.path).toContain("analyze_default_ast"),
		);
	});

	test("intent read → read_enhanced", () => {
		expectLeaf(tree, { intent: "read", scope: "operations" }, "read_enhanced");
	});

	test("intent write → write_enhanced", () => {
		expectLeaf(tree, { intent: "write", scope: "operations" }, "write_enhanced");
	});

	test("intent edit → edit_enhanced", () => {
		expectLeaf(tree, { intent: "edit", scope: "content" }, "edit_enhanced");
	});

	test("intent shell → shell_enhanced", () => {
		expectLeaf(tree, { intent: "shell", scope: "operations" }, "shell_enhanced");
	});

	test("intent list → ls_enhanced", () => {
		expectLeaf(tree, { intent: "list", scope: "files", features: ["repo-topology"] }, "ls_enhanced");
	});

	test("intent find + fuzzy → fuzzy_find", () => {
		expectLeaf(
			tree,
			{ intent: "find", specificity: "fuzzy", scope: "files" },
			"fuzzy_find",
			(r) => expect(r.path.includes("intent_find")).toBe(true),
		);
	});

	test("intent find + exact-ish → find_files", () => {
		expectLeaf(
			tree,
			{ intent: "find", specificity: "exact", scope: "files" },
			"find_files",
			(r) => expect(r.path).toContain("find_exact"),
		);
	});

	test("intent search + conceptual → concept_search", () => {
		expectLeaf(
			tree,
			{ intent: "search", specificity: "conceptual", scope: "content" },
			"concept_search",
			(r) => expect(r.path).toContain("search_conceptual"),
		);
	});

	test("intent search + ripgrep-advanced beats conceptual overlap", () => {
		expectLeaf(
			tree,
			{
				intent: "search",
				specificity: "conceptual",
				scope: "content",
				features: ["ripgrep-advanced"],
			},
			"ripgrep",
			(r) => expect(r.path.some(p => p.includes("ripgrep"))).toBe(true), // Matches either ripgrep_preferred or ripgrep_advanced
		);
	});

	test("intent search default regex path → search", () => {
		expectLeaf(tree, { intent: "search", specificity: "exact", hasPattern: true, patternType: "regex" }, "search");
	});
});

describe("DecisionTree scoring and fallbacks", () => {
	test("root defaultLeaf when nothing matches intents at root", () => {
		const emptyRoot = parseTreeConfig({
			version: 1,
			root: {
				id: "empty_root",
				question: "Unreachable branches",
				branches: [
					{
						id: "never",
						priority: 1,
						match: { intent: "shell" as const },
						leaf: { tool: "shell_enhanced", baseConfidence: 0.9 },
					},
				],
				defaultLeaf: { tool: "search", baseConfidence: 0.55 },
			},
		});
		const r = new DecisionTree(emptyRoot).traverse(
			ctx({ intent: "search", specificity: "exact", binaryAvailability: allBinariesAvailableSnapshot() }),
		);
		expect(r.tool).toBe("search");
		expect(r.path).toHaveLength(0);
		expect(r.confidence).toBeLessThan(0.75);
	});

	test("inner defaultLeaf when nested branch has no matching child", () => {
		const cfg = parseTreeConfig({
			version: 1,
			root: {
				id: "root",
				branches: [
					{
						id: "into_find",
						priority: 50,
						match: { intent: "find" },
						branch: {
							id: "find_inner",
							branches: [],
							defaultLeaf: { tool: "find_files", baseConfidence: 0.66, requiredBinaries: ["fd"] },
						},
					},
				],
				defaultLeaf: { tool: "search", baseConfidence: 0.4 },
			},
		});
		const r = new DecisionTree(cfg).traverse(ctx({ intent: "find", specificity: "fuzzy" }));
		expect(r.tool).toBe("find_files");
		expect(r.pathLabels.join(" ")).toContain("[default:find_inner]");
	});

	test("reduces confidence when required binaries are unavailable", () => {
		const bins = allBinariesAvailableSnapshot();
		const rOk = new DecisionTree().traverse(
			ctx({ intent: "analyze", features: ["security-audit"], binaryAvailability: bins }),
		);
		const rBad = new DecisionTree().traverse(
			ctx({
				intent: "analyze",
				features: ["security-audit"],
				binaryAvailability: { byBinary: { ...bins.byBinary, semgrep: { available: false } } },
			}),
		);
		expect(rBad.tool).toBe("semgrep");
		expect(rBad.binariesSatisfied).toBe(false);
		expect(rBad.confidence).toBeLessThan(rOk.confidence);
	});
});
