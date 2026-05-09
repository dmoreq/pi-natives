import { describe, expect, test } from "bun:test";
import { BinaryManager, createBinaryRequirements } from "../../src/core/binary-manager";
import { FileTypeRegistry } from "../../src/core/file-type-registry";
import { ToolRegistry } from "../../src/core/tool-registry";
import { allToolDescriptors } from "../../src/tool-descriptors";
import { PI_SHERLOCK_ROUTING_TOOL_COUNT, SmartRouter } from "../../src/routing";
import type { PiSherlockToolName } from "../../src/routing/types";
function makeRouter(extra?: ConstructorParameters<typeof SmartRouter>[3]): SmartRouter {
	const bm = new BinaryManager({ showNotifications: false });
	for (const req of Object.values(createBinaryRequirements())) {
		bm.setBinaryOverride(req.binary, true);
	}
	const registry = new ToolRegistry(bm);
	registry.registerAll(allToolDescriptors);
	return new SmartRouter(bm, FileTypeRegistry, registry, {
		supplementalRegisteredTools: ["search", "concept_search"],
		...extra,
	});
}

describe("SmartRouter integration", () => {
	test("exposes canonical 14-tool surface", () => {
		expect(PI_SHERLOCK_ROUTING_TOOL_COUNT).toBe(14);
		expect(SmartRouter.routedToolNames()).toHaveLength(14);
	});

	test("routes representative queries to each pi-sherlock tool", () => {
		const router = makeRouter();
		const cases: { query: string; expected: PiSherlockToolName; filePath?: string }[] = [
			{ query: "Find authentication related code in the backend", expected: "concept_search" },
			{ query: String.raw`grep for /\bDEPRECATED\b/ across src with regex pattern matching`, expected: "search" },
			{ query: "multiline rg search hidden files across repo", expected: "ripgrep" },
			{ query: "Find all *.ts files under src/components", expected: "find_files" },
			{ query: "might be called cfg or config something — fuzzy_find my config file path", expected: "fuzzy_find" },
			{ query: "Owasp-inspired security audit of this codebase", expected: "semgrep" },
			{ query: "structural audit ast-grep metavar $X for call sites", expected: "ast_grep" },
			{ query: "jscpd-style duplicate detection on src", expected: "find_duplicates" },
			{ query: "tokei / lines of code breakdown for Rust services", expected: "count_lines" },
			{ query: "structured json output shell_enhanced for git metadata", expected: "shell_enhanced" },
			{ query: "repository structure topology ls_enhanced overview", expected: "ls_enhanced" },
			{ query: "read_enhanced show structure for this module", expected: "read_enhanced", filePath: "pkg/mod.ts" },
			{ query: "edit_enhanced AST preview rewrite for exports", expected: "edit_enhanced" },
			{ query: "write_enhanced atomic save overwrite file", expected: "write_enhanced" },
		];

		for (const { query, expected, filePath } of cases) {
			const d = router.route(query, filePath);
			expect(d.primaryTool).toBe(expected);
		}
	});

	test("merges reasoning from engine and tree on agreement", () => {
		const router = makeRouter();
		const d = router.route("Find authentication related code in the backend");
		expect(d.reasoning.some((r) => /agree/i.test(r))).toBe(true);
		expect(d.reasoning.some((r) => /decision tree route/i.test(r))).toBe(true);
	});

	test("records merge line when sources can disagree", () => {
		const router = makeRouter();
		const d = router.route("routing readiness ping");
		expect(d.reasoning.some((r) => /Merged routing:/i.test(r) || /agree/i.test(r))).toBe(true);
	});

	test("remaps unregistered concept_search/search to registered fallbacks when needed", () => {
		const bm = new BinaryManager({ showNotifications: false });
		for (const req of Object.values(createBinaryRequirements())) {
			bm.setBinaryOverride(req.binary, true);
		}
		const registry = new ToolRegistry(bm);
		registry.registerAll(allToolDescriptors);
		const routerNoSupplement = new SmartRouter(bm, FileTypeRegistry, registry);
		const explicitRegex = routerNoSupplement.route(String.raw`grep for /\bDEPRECATED\b/ across src`);
		expect(explicitRegex.primaryTool).toBe("ripgrep");
		const conceptual = routerNoSupplement.route("Find authentication related code in the backend");
		expect(conceptual.primaryTool).toBe("ripgrep");
		expect(conceptual.reasoning.join(" ")).toMatch(/concept_search|Merged routing|agree/i);
	});

	test("prefers registered alternates when primary missing from registry map", () => {
		const bm = new BinaryManager({ showNotifications: false });
		for (const req of Object.values(createBinaryRequirements())) {
			bm.setBinaryOverride(req.binary, true);
		}
		const registry = new ToolRegistry(bm);
		registry.register({
			...allToolDescriptors.find((t) => t.id === "fd")!,
		});
		const routerSparse = new SmartRouter(bm, FileTypeRegistry, registry, {
			supplementalRegisteredTools: ["search"],
		});
		const d = routerSparse.route("might be called cfg or config something fuzzy");
		expect(d.primaryTool).toBe("find_files");
	});

	test("respects unavailable semgrep binary in merged decision", () => {
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
		const d = router.route("Owasp-inspired security audit of this codebase");
		expect(d.primaryTool).not.toBe("semgrep");
		expect(["ast_grep", "search"]).toContain(d.primaryTool);
	});
});
