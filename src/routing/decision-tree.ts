/**
 * Decision-tree traversal over {@link ToolContext} with configurable branch matching,
 * leaf confidence, and optional binary availability adjustments.
 */

import rawTreeConfig from "./tree-config.json";
import type {
	BinaryAvailabilitySnapshot,
	PatternKind,
	PiSherlockToolName,
	ScopeKind,
	SpecificityKind,
	ToolContext,
	ToolIntent,
} from "./types";

export interface TreeLeafConfig {
	readonly tool: PiSherlockToolName;
	readonly baseConfidence: number;
	readonly requiredBinaries?: readonly string[];
}

export interface TreeMatchCriteria {
	readonly intent?: ToolIntent | ToolIntent[];
	readonly specificity?: SpecificityKind | SpecificityKind[];
	readonly scope?: ScopeKind | ScopeKind[];
	readonly hasPattern?: boolean;
	readonly patternType?: PatternKind | PatternKind[];
	readonly featuresAny?: readonly string[];
	readonly featuresAll?: readonly string[];
}

export interface TreeBranchOption {
	readonly id: string;
	readonly priority?: number;
	readonly match?: TreeMatchCriteria;
	readonly leaf?: TreeLeafConfig;
	readonly branch?: TreeBranchNode;
}

export interface TreeBranchNode {
	readonly id?: string;
	readonly question?: string;
	readonly branches: readonly TreeBranchOption[];
	readonly defaultLeaf?: TreeLeafConfig;
}

export interface TreeConfigFile {
	readonly version: number;
	readonly root: TreeBranchNode;
}

export interface TreeTraversalResult {
	readonly tool: PiSherlockToolName;
	readonly confidence: number;
	/** Stable branch identifiers from root → leaf (excludes synthesized defaults). */
	readonly path: readonly string[];
	/** Human-readable step labels for logging or merged routing reasoning. */
	readonly pathLabels: readonly string[];
	readonly baseConfidence: number;
	readonly binariesSatisfied: boolean;
}

function asToolName(tool: string): PiSherlockToolName {
	const allowed = new Set<string>([
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
	]);
	if (!allowed.has(tool)) {
		throw new Error(`Decision tree referenced unknown tool "${tool}".`);
	}
	return tool as PiSherlockToolName;
}

function normalizeLeaf(raw: {
	tool: string;
	baseConfidence: number;
	requiredBinaries?: readonly string[];
}): TreeLeafConfig {
	return {
		tool: asToolName(raw.tool),
		baseConfidence: raw.baseConfidence,
		requiredBinaries: raw.requiredBinaries ? [...raw.requiredBinaries] : undefined,
	};
}

function satisfiesBinaries(
	snapshot: BinaryAvailabilitySnapshot | undefined,
	required?: readonly string[],
): boolean {
	if (!required?.length) return true;
	if (!snapshot?.byBinary) return false;
	return required.every((name) => snapshot.byBinary[name]?.available === true);
}

function matchCriteria(context: ToolContext, criteria?: TreeMatchCriteria): boolean {
	if (!criteria || Object.keys(criteria).length === 0) return true;

	const {
		intent,
		specificity,
		scope,
		hasPattern,
		patternType,
		featuresAny,
		featuresAll,
	} = criteria;

	const inSet = <T>(value: T | undefined, expected: T | readonly T[] | undefined): boolean => {
		if (expected === undefined) return true;
		if (value === undefined) return false;
		const arr = Array.isArray(expected) ? expected : [expected];
		return (arr as readonly T[]).includes(value);
	};

	if (!inSet(context.intent, intent)) return false;
	if (!inSet(context.specificity, specificity)) return false;
	if (!inSet(context.scope, scope)) return false;

	if (hasPattern !== undefined && context.hasPattern !== hasPattern) return false;
	if (!inSet(context.patternType, patternType)) return false;

	const feats = context.features ?? [];

	if (featuresAny?.length) {
		const hit = featuresAny.some((f) => feats.includes(f));
		if (!hit) return false;
	}

	if (featuresAll?.length) {
		const ok = featuresAll.every((f) => feats.includes(f));
		if (!ok) return false;
	}

	return true;
}

function optionPriority(option: TreeBranchOption): number {
	return option.priority ?? 0;
}

function matchQualityBonus(criteria?: TreeMatchCriteria): number {
	if (!criteria) return 0;
	let n = 0;
	if (criteria.intent !== undefined) n += 1;
	if (criteria.specificity !== undefined) n += 1;
	if (criteria.scope !== undefined) n += 1;
	if (criteria.hasPattern !== undefined) n += 1;
	if (criteria.patternType !== undefined) n += 1;
	if (criteria.featuresAny?.length) n += 1;
	if (criteria.featuresAll?.length) n += 1;
	return Math.min(0.04, n * 0.006);
}

function finalizeConfidence(params: {
	base: number;
	optionPriority: number;
	match?: TreeMatchCriteria;
	binariesSatisfied: boolean;
}): number {
	let score = params.base + matchQualityBonus(params.match);
	score += Math.min(params.optionPriority / 20000, 0.025);
	if (!params.binariesSatisfied) score *= 0.72;
	return Math.min(0.97, Number(score.toFixed(3)));
}

export function parseTreeConfig(data: unknown): TreeConfigFile {
	const file = data as TreeConfigFile;
	if (!file || typeof file !== "object" || file.version !== 1 || !file.root) {
		throw new Error("Invalid decision tree configuration (expected version 1 with root).");
	}
	return file;
}

export function collectTreeTools(root: TreeBranchNode): PiSherlockToolName[] {
	const out = new Set<PiSherlockToolName>();

	const visitBranch = (node: TreeBranchNode): void => {
		if (node.defaultLeaf) {
			out.add(normalizeLeaf(node.defaultLeaf as never).tool);
		}
		for (const opt of node.branches) {
			if (opt.leaf) out.add(normalizeLeaf(opt.leaf as never).tool);
			if (opt.branch) visitBranch(opt.branch);
		}
	};

	visitBranch(root);
	return [...out];
}

/** Built-in bundled decision tree configuration. */
export const BUNDLED_TREE_CONFIG: TreeConfigFile = parseTreeConfig(rawTreeConfig as unknown);

export class DecisionTree {
	private readonly cfg: TreeConfigFile;

	constructor(config?: TreeConfigFile) {
		this.cfg = config ?? BUNDLED_TREE_CONFIG;
	}

	traverse(context: ToolContext): TreeTraversalResult {
		const path: string[] = [];
		const pathLabels: string[] = [];
		let node = this.cfg.root;

		for (;;) {
			if (node.question) {
				pathLabels.push(`${node.question}`);
			}

			const eligible = node.branches
				.filter((b) => matchCriteria(context, b.match))
				.sort((a, b) => optionPriority(b) - optionPriority(a));

			const pick = eligible[0];
			let leaf: TreeLeafConfig | undefined;
			let usedDefault = false;

			if (!pick) {
				if (!node.defaultLeaf) {
					throw new Error(`Decision tree dead-end at branch "${node.id ?? "unknown"}" (no matches, no defaultLeaf).`);
				}
				leaf = normalizeLeaf(node.defaultLeaf as never);
				usedDefault = true;
				pathLabels.push(`[default:${node.id ?? "branch"}] → ${leaf.tool}`);
			} else if (pick.branch) {
				path.push(pick.id);
				pathLabels.push(`→ ${pick.id}`);
				node = pick.branch;
				continue;
			} else if (pick.leaf) {
				path.push(pick.id);
				pathLabels.push(`→ ${pick.id}`);
				leaf = normalizeLeaf(pick.leaf as never);
			} else {
				throw new Error(`Decision tree option "${pick.id}" must define leaf or branch.`);
			}

			const binariesSatisfied = satisfiesBinaries(context.binaryAvailability, leaf.requiredBinaries);
			const confidence = finalizeConfidence({
				base: leaf.baseConfidence,
				optionPriority: usedDefault ? 0 : pick ? optionPriority(pick) : 0,
				match: usedDefault ? undefined : pick?.match,
				binariesSatisfied,
			});

			return {
				tool: leaf.tool,
				confidence,
				path: Object.freeze(path) as readonly string[],
				pathLabels: Object.freeze(pathLabels) as readonly string[],
				baseConfidence: leaf.baseConfidence,
				binariesSatisfied,
			};
		}
	}
}
