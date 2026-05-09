import { describe, test, expect } from "bun:test";
import { BinaryManager, createBinaryRequirements } from "../../src/core/binary-manager";
import { ContextAnalyzer } from "../../src/routing/context-analyzer";
import { DecisionEngine } from "../../src/routing/decision-engine";
import { allBinariesAvailableSnapshot } from "./test-helpers";

function makeAnalyzer(): ContextAnalyzer {
	const bm = new BinaryManager();
	for (const req of Object.values(createBinaryRequirements())) {
		bm.setBinaryOverride(req.binary, true);
	}
	return new ContextAnalyzer(bm);
}

describe("ContextAnalyzer + DecisionEngine routing", () => {
	const analyzer = makeAnalyzer();
	const engine = new DecisionEngine();
	const bins = allBinariesAvailableSnapshot();

	const route = (query: string, filePath?: string) => {
		const ctx = analyzer.analyzeQuery(query, filePath);
		ctx.binaryAvailability = bins;
		return engine.decide(ctx);
	};

	test("routes conceptual discovery to concept_search", () => {
		const d = route("Find authentication related code in the backend");
		expect(d.primaryTool).toBe("concept_search");
	});

	test("routes explicit regex to search", () => {
		const d = route(String.raw`grep for /\bDEPRECATED\b/ across src`);
		expect(d.primaryTool).toBe("search");
		expect(d.secondaryTools.some((t) => t.includes("concept")) || d.fallbacks.includes("concept_search")).toBe(true);
	});

	test("routes advanced rg cues to ripgrep", () => {
		const d = route("multiline rg search hidden files across repo");
		expect(d.primaryTool).toBe("ripgrep");
	});

	test("routes file enumeration to find_files", () => {
		const d = route("Find all *.ts files under src/components");
		expect(d.primaryTool).toBe("find_files");
	});

	test("routes fuzzy filenames to fuzzy_find", () => {
		const d = route("might be called cfg or config something — fuzzy_find my config file path");
		expect(d.primaryTool).toBe("fuzzy_find");
	});

	test("routes security wording to semgrep", () => {
		const d = route("Owasp-inspired security audit of this codebase");
		expect(d.primaryTool).toBe("semgrep");
	});

	test("routes duplication detection to find_duplicates", () => {
		const d = route("jscpd-style duplicate detection on src");
		expect(d.primaryTool).toBe("find_duplicates");
	});

	test("routes line counts to count_lines", () => {
		const d = route("tokei / lines of code breakdown for Rust services");
		expect(d.primaryTool).toBe("count_lines");
	});

	test("routes shell json intent to shell_enhanced", () => {
		const d = route("structured json output shell_enhanced for git metadata");
		expect(d.primaryTool).toBe("shell_enhanced");
	});

	test("routes topology listing intent to ls_enhanced", () => {
		const d = route("repository structure topology ls_enhanced overview");
		expect(d.primaryTool).toBe("ls_enhanced");
	});

	test("routes code read with path to ast-aware read tier", () => {
		const ctx = analyzer.analyzeQuery("read_enhanced show structure for this module", "pkg/mod.ts");
		ctx.binaryAvailability = bins;
		const d = engine.decide(ctx);
		expect(d.primaryTool).toBe("read_enhanced");
		expect(d.reasoning.length).toBeGreaterThan(0);
	});

	test("uses binary availability when required tools are unavailable", () => {
		const ctx = analyzer.analyzeQuery("Owasp-inspired security audit of this codebase");
		ctx.binaryAvailability = {
			byBinary: { ...bins.byBinary, semgrep: { available: false } },
		};
		const d = engine.decide(ctx);
		expect(d.primaryTool).not.toBe("semgrep");
		expect(["ast_grep", "search"]).toContain(d.primaryTool);
	});
});

describe("contextMatchesSubset & rule snapshot", () => {
	test("exports stable ordered rules", () => {
		const snapshot = new DecisionEngine().exportRulesSnapshot();
		expect(snapshot.length).toBeGreaterThan(8);
		const priorities = snapshot.map((r) => r.priority);
		const sorted = [...priorities].sort((a, b) => b - a);
		expect(priorities).toEqual(sorted);
	});
});
