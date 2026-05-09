import { describe, expect, test } from "bun:test";
import { BinaryManager, createBinaryRequirements } from "../../src/core/binary-manager";
import { FileTypeRegistry } from "../../src/core/file-type-registry";
import { ToolRegistry } from "../../src/core/tool-registry";
import { allToolDescriptors } from "../../src/tool-descriptors";
import { DecisionEngine } from "../../src/routing/decision-engine";
import {
	PI_SHERLOCK_ROUTING_TOOL_COUNT,
	SmartRouter,
	type SmartRouterOptions,
} from "../../src/routing";
import type { PiSherlockToolName } from "../../src/routing/types";

function makeRouter(options?: SmartRouterOptions): SmartRouter {
	const bm = new BinaryManager({ showNotifications: false });
	for (const req of Object.values(createBinaryRequirements())) {
		bm.setBinaryOverride(req.binary, true);
	}
	const registry = new ToolRegistry(bm);
	registry.registerAll(allToolDescriptors);
	return new SmartRouter(bm, FileTypeRegistry, registry, {
		supplementalRegisteredTools: ["search", "concept_search"],
		...options,
	});
}

describe("Smart routing end-to-end", () => {
	test("covers all 14 routed tools through representative multilingual queries", () => {
		const router = makeRouter();
		const cases: { query: string; expected: PiSherlockToolName; filePath?: string }[] = [
			{
				query: "grep with regex pattern matching for literals about payment failure strings",
				expected: "search",
			},
			{
				query: "anything about retries and backoff in networking code conceptual relevance",
				expected: "concept_search",
			},
			{
				query: "multiline ripgrep search hidden vendor tree with --hidden",
				expected: "ripgrep",
			},
			{
				query: "list all *.tsx components under packages/app with globs find_files task",
				expected: "find_files",
			},
			{
				query: "might be called rollup or rspack fuzzy_find similar build config filename",
				expected: "fuzzy_find",
			},
			{
				query: "Owasp SAST CVE semgrep oriented security posture audit for CI",
				expected: "semgrep",
			},
			{
				query: "structural audit ast-grep metavar $FN for call sites",
				expected: "ast_grep",
			},
			{
				query: "tokei LOC metrics breakdown for Go microservices repositories",
				expected: "count_lines",
			},
			{
				query: "jscpd duplicate copy paste blocks detectors on services layer",
				expected: "find_duplicates",
			},
			{
				query: "read_enhanced smart read skeleton skim for typescript module APIs",
				expected: "read_enhanced",
				filePath: "packages/api/mod.ts",
			},
			{
				query: "write_enhanced atomic streaming save large telemetry payload",
				expected: "write_enhanced",
			},
			{
				query: "edit_enhanced preview AST refactor rename exported wrapper",
				expected: "edit_enhanced",
			},
			{
				query: "shell_enhanced structured json for git blame metadata via nushell",
				expected: "shell_enhanced",
			},
			{
				query: "ls_enhanced repository topology directories overview with git hints",
				expected: "ls_enhanced",
			},
		];

		const hit = new Set<PiSherlockToolName>();
		for (const { query, expected, filePath } of cases) {
			const decision = router.route(query, filePath);
			expect(decision.primaryTool).toBe(expected);
			hit.add(expected);
		}
		expect(hit.size).toBe(PI_SHERLOCK_ROUTING_TOOL_COUNT);
	});

	test("records merged routing when default engine intent disagrees with the decision tree leaf", () => {
		const router = makeRouter({
			decisionEngine: new DecisionEngine([]),
			engineWeight: 0.52,
			treeWeight: 0.48,
		});
		const decision = router.route("Find authentication related code in the backend");
		expect(decision.primaryTool).toBe("concept_search");
		expect(decision.reasoning.some((line) => /Merged routing:/i.test(line))).toBe(true);
		expect(decision.secondaryTools).toContain("search");
	});

	test("downgrades semgrep routing when binary is unavailable while staying coherent", () => {
		const bm = new BinaryManager({ showNotifications: false });
		for (const req of Object.values(createBinaryRequirements())) {
			bm.setBinaryOverride(req.binary, true);
		}
		bm.setBinaryOverride("semgrep", false);

		const registry = new ToolRegistry(bm);
		registry.registerAll(allToolDescriptors);
		const router = new SmartRouter(bm, FileTypeRegistry, registry, {
			supplementalRegisteredTools: ["search", "concept_search"],
		});

		const decision = router.route("Owasp-aligned security penetration audit scanning whole service");
		expect(decision.primaryTool).not.toBe("semgrep");
		expect(decision.reasoning.join(" ").toLowerCase()).toMatch(/binary|merged|intent|tree/i);
	});

	test("prioritizes high-signal refactor intent even when ambiguous count tokens appear", () => {
		const router = makeRouter();
		const decision = router.route("count repeated duplicate clones jscpd style across graphql layer");
		expect(decision.primaryTool).toBe("find_duplicates");
		expect(decision.confidence).toBeGreaterThan(0.7);
	});

	test("documents registry fallback chains when supplementary tools lack descriptor registration", () => {
		const bm = new BinaryManager({ showNotifications: false });
		for (const req of Object.values(createBinaryRequirements())) {
			bm.setBinaryOverride(req.binary, true);
		}

		const registry = new ToolRegistry(bm);
		registry.registerAll(allToolDescriptors);
		const sparse = new SmartRouter(bm, FileTypeRegistry, registry);

		const regexish = sparse.route(String.raw`literal pattern matching /\bpanic!\b/ in rust crates`);
		expect(regexish.primaryTool).toBe("ripgrep");

		const conceptual = sparse.route("Find authentication related code in the backend");
		expect(conceptual.primaryTool).toBe("ripgrep");
		expect(conceptual.reasoning.join(" ").toLowerCase()).toMatch(/concept_search|merged|agree|bm25/i);
	});

	test("elevates fuzzy_find over find_files when wording signals approximate filenames", () => {
		const router = makeRouter();
		const decision = router.route("might be called turbo or vite fuzzy filename similar fuzzy_find cfg");
		expect(decision.primaryTool).toBe("fuzzy_find");
	});

	test("keeps strengthened confidence when engine and decision tree converge", () => {
		const router = makeRouter();
		const decision = router.route("semantic conceptual search relevance about authentication backends");
		expect(decision.reasoning.some((line) => /agree/i.test(line))).toBe(true);
		expect(decision.confidence).toBeGreaterThan(0.75);
	});

	test("captures actionable fallbacks after low-signal warmup queries", () => {
		const router = makeRouter();
		const decision = router.route("routing readiness ping");
		expect(Array.isArray(decision.fallbacks)).toBe(true);
		expect(decision.fallbacks.length).toBeGreaterThan(0);
		expect(decision.reasoning.length).toBeGreaterThan(0);
	});
});
