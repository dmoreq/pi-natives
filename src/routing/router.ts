/**
 * Unified smart router: {@link ContextAnalyzer} + {@link DecisionEngine} + {@link DecisionTree}
 * with weighted confidence merge and optional {@link ToolRegistry} filtering.
 */

import type { BinaryManager } from "../core/binary-manager";
import { FileTypeRegistry } from "../core/file-type-registry";
import type { ToolRegistry } from "../core/tool-registry";
import { ContextAnalyzer } from "./context-analyzer";
import type { FileTypeClassifier } from "./context-analyzer";
import { DecisionEngine, ROUTING_TOOL_FALLBACKS } from "./decision-engine";
import { DecisionTree, type TreeTraversalResult } from "./decision-tree";
import type {
	BinaryAvailabilitySnapshot,
	PiSherlockToolName,
	RoutingDecision,
	ToolContext,
} from "./types";

const ALL_PI_TOOLS: readonly PiSherlockToolName[] = [
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
];

/** Maps declarative descriptor `id` → pi `name` field for tools registered via {@link ToolRegistry}. */
const DESCRIPTOR_ID_TO_PI_TOOL: Record<string, PiSherlockToolName> = {
	"read-enhanced": "read_enhanced",
	"write-enhanced": "write_enhanced",
	"edit-enhanced": "edit_enhanced",
	"shell-enhanced": "shell_enhanced",
	"ls-enhanced": "ls_enhanced",
	fd: "find_files",
	fzf: "fuzzy_find",
	"ast-grep": "ast_grep",
	tokei: "count_lines",
	jscpd: "find_duplicates",
	ripgrep: "ripgrep",
	semgrep: "semgrep",
};

export const PI_SHERLOCK_ROUTING_TOOL_COUNT = ALL_PI_TOOLS.length;

export type SmartRouterOptions = {
	decisionEngine?: DecisionEngine;
	decisionTree?: DecisionTree;
	/** Default 0.52 — rule engine when scores tie (after weighting). */
	engineWeight?: number;
	/** Default 0.48 */
	treeWeight?: number;
	/**
	 * Tools known to be registered outside the descriptor list (e.g. `search` / `concept_search`).
	 * Ignored when {@link ToolRegistry} has no descriptors.
	 */
	supplementalRegisteredTools?: readonly PiSherlockToolName[];
};

function uniqStrings(items: string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const x of items) {
		if (!seen.has(x)) {
			seen.add(x);
			out.push(x);
		}
	}
	return out;
}

function buildRegisteredToolSet(
	registry: ToolRegistry | undefined,
	supplemental: readonly PiSherlockToolName[] | undefined,
): Set<PiSherlockToolName> | null {
	if (!registry) return null;
	const desc = registry.getAllTools();
	if (!desc.length) return null;
	const set = new Set<PiSherlockToolName>();
	for (const d of desc) {
		const mapped = DESCRIPTOR_ID_TO_PI_TOOL[d.id] ?? (d.id as PiSherlockToolName);
		set.add(mapped);
	}
	for (const s of supplemental ?? []) {
		set.add(s);
	}
	return set;
}

function satisfiesBinaries(snapshot: BinaryAvailabilitySnapshot | undefined, required?: readonly string[]): boolean {
	if (!required?.length) return true;
	if (!snapshot?.byBinary) return false;
	return required.every((name) => snapshot.byBinary[name]?.available === true);
}

export class SmartRouter {
	private readonly analyzer: ContextAnalyzer;
	private readonly engine: DecisionEngine;
	private readonly tree: DecisionTree;
	private readonly engineWeight: number;
	private readonly treeWeight: number;
	private readonly registeredTools: Set<PiSherlockToolName> | null;

	constructor(
		binaryManager: BinaryManager,
		_fileTypeRegistry: typeof FileTypeRegistry,
		toolRegistry?: ToolRegistry,
		options?: SmartRouterOptions,
	) {
		const classifier: FileTypeClassifier = {
			classify(filePath: string) {
				return _fileTypeRegistry.classify(filePath);
			},
		};
		this.analyzer = new ContextAnalyzer(binaryManager, classifier);
		this.engine = options?.decisionEngine ?? new DecisionEngine();
		this.tree = options?.decisionTree ?? new DecisionTree();
		this.engineWeight = options?.engineWeight ?? 0.52;
		this.treeWeight = options?.treeWeight ?? 0.48;
		this.registeredTools = buildRegisteredToolSet(toolRegistry, options?.supplementalRegisteredTools);
	}

	/** Canonical count of routed pi-sherlock tools (currently 14). */
	static routedToolNames(): readonly PiSherlockToolName[] {
		return ALL_PI_TOOLS;
	}

	route(query: string, filePath?: string): RoutingDecision {
		const context = this.analyzer.analyzeQuery(query.trim(), filePath);
		const engineDecision = this.engine.decide(context);
		const treeResult = this.tree.traverse(context);
		let merged = this.combineDecisions(engineDecision, treeResult, context);
		merged = this.applyRegistrationFilter(merged);
		return merged;
	}

	private isToolRegistered(name: string): boolean {
		if (!this.registeredTools) return true;
		if (this.registeredTools.has(name as PiSherlockToolName)) return true;
		return false;
	}

	private reachableAlternateTools(tool: string): string[] {
		const ordered: string[] = [];
		const visited = new Set<string>();
		const queue: string[] = [...(ROUTING_TOOL_FALLBACKS[tool] ?? [])];
		while (queue.length) {
			const t = queue.shift()!;
			if (visited.has(t)) continue;
			visited.add(t);
			ordered.push(t);
			queue.push(...(ROUTING_TOOL_FALLBACKS[t] ?? []));
		}
		return ordered;
	}

	private applyRegistrationFilter(decision: RoutingDecision): RoutingDecision {
		if (!this.registeredTools) return decision;
		let primary = decision.primaryTool;
		if (!this.isToolRegistered(primary)) {
			const candidates = uniqStrings([
				...decision.secondaryTools,
				...decision.fallbacks,
				...this.reachableAlternateTools(primary),
			]);
			const replacement = candidates.find((t) => this.isToolRegistered(t));
			if (replacement) primary = replacement;
		}

		const secondaries = decision.secondaryTools.filter((t) => t !== primary && this.isToolRegistered(t));
		const fallbacks = decision.fallbacks.filter((t) => t !== primary && this.isToolRegistered(t));

		return {
			...decision,
			primaryTool: primary,
			secondaryTools: secondaries.slice(0, 6),
			fallbacks: fallbacks.slice(0, 8),
		};
	}

	private combineDecisions(
		engineDecision: RoutingDecision,
		treeResult: TreeTraversalResult,
		context: ToolContext,
	): RoutingDecision {
		const treePrimary = treeResult.tool;
		if (engineDecision.primaryTool === treePrimary) {
			const reqs = uniqStrings([
				...(engineDecision.binaryRequirements ?? []),
				...(treeResult.requiredBinaries ?? []),
			]);
			return {
				...engineDecision,
				confidence: Math.min(0.97, Math.max(engineDecision.confidence, treeResult.confidence)),
				reasoning: uniqStrings([
					`Rule engine + decision tree agree on '${treePrimary}'.`,
					...engineDecision.reasoning,
					...this.treeReasonLines(treeResult, context),
				]),
				binaryRequirements: reqs.length ? reqs : engineDecision.binaryRequirements,
			};
		}

		const wE = this.engineWeight;
		const wT = this.treeWeight;
		let engineWeighted = wE * engineDecision.confidence;
		let treeWeighted = wT * treeResult.confidence;

		const treeBlocked =
			Boolean(treeResult.requiredBinaries?.length) &&
			!satisfiesBinaries(context.binaryAvailability, treeResult.requiredBinaries);
		const engineReqUnsatisfied =
			Boolean(engineDecision.binaryRequirements?.length) &&
			!satisfiesBinaries(context.binaryAvailability, engineDecision.binaryRequirements);

		if (treeBlocked) treeWeighted *= 0.65;
		if (engineReqUnsatisfied) engineWeighted *= 0.65;

		const tieBreakEngine = treeWeighted <= engineWeighted;
		const reasoningBase = uniqStrings([
			`Merged routing: engine primary='${engineDecision.primaryTool}' (weighted=${engineWeighted.toFixed(
				3,
			)}), tree primary='${treePrimary}' (weighted=${treeWeighted.toFixed(3)}).`,
			...engineDecision.reasoning,
			...this.treeReasonLines(treeResult, context),
		]);

		if (tieBreakEngine) {
			return {
				...engineDecision,
				secondaryTools: uniqStrings([
					treePrimary,
					...engineDecision.secondaryTools,
				]).slice(0, 6),
				confidence: Math.min(
					0.97,
					Number((engineWeighted + treeWeighted * 0.35).toFixed(3)),
				),
				reasoning: reasoningBase,
				binaryRequirements: engineDecision.binaryRequirements,
			};
		}

		const treeDecision: RoutingDecision = {
			primaryTool: treePrimary,
			secondaryTools: uniqStrings([
				engineDecision.primaryTool,
				...engineDecision.secondaryTools,
			]).slice(0, 6),
			confidence: Math.min(0.97, Number((treeWeighted + engineWeighted * 0.35).toFixed(3))),
			reasoning: reasoningBase,
			fallbacks: engineDecision.fallbacks,
			enhancedFeatures: engineDecision.enhancedFeatures,
			binaryRequirements: treeResult.requiredBinaries?.length
				? [...treeResult.requiredBinaries]
				: undefined,
		};
		return treeDecision;
	}

	private treeReasonLines(treeResult: TreeTraversalResult, context: ToolContext): string[] {
		const reqs = treeResult.requiredBinaries;
		const gate =
			reqs?.length && !treeResult.binariesSatisfied
				? `required binaries unsatisfied (${reqs.join(", ")}); confidence discounted in merge.`
				: "";
		const pathNote =
			treeResult.pathLabels.length > 0 ? `Decision tree route: ${treeResult.pathLabels.join(" ")}` : "";
		return uniqStrings([
			pathNote,
			`Intent context: ${context.intent} / ${context.specificity} / ${context.scope}`,
			gate,
		]).filter(Boolean);
	}
}
