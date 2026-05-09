/**
 * Applies ordered routing rules to a resolved ToolContext.
 */

import type {
	BinaryAvailabilitySnapshot,
	PiSherlockToolName,
	RoutingDecision,
	RoutingRule,
	ScopeKind,
	SpecificityKind,
	ToolContext,
	ToolIntent,
} from "./types";
import { FileType, type FileClassification } from "../core/file-type-registry";

const TOOL_FALLBACKS: Record<string, PiSherlockToolName[]> = {
	search: ["ripgrep", "concept_search"],
	concept_search: ["search"],
	ripgrep: ["search"],
	find_files: ["fuzzy_find"],
	fuzzy_find: ["find_files"],
	semgrep: ["ast_grep", "search"],
	ast_grep: ["semgrep", "search"],
	count_lines: ["find_files"],
	find_duplicates: ["ast_grep"],
	read_enhanced: ["search"],
	write_enhanced: ["shell_enhanced"],
	edit_enhanced: ["shell_enhanced"],
	shell_enhanced: [],
	ls_enhanced: ["find_files"],
};

const INTENT_DEFAULT_PRIMARY: Record<ToolIntent, PiSherlockToolName> = {
	search: "search",
	find: "find_files",
	analyze: "ast_grep",
	count: "count_lines",
	refactor: "find_duplicates",
	read: "read_enhanced",
	write: "write_enhanced",
	edit: "edit_enhanced",
	shell: "shell_enhanced",
	list: "ls_enhanced",
};

function contextMatchesSubset(context: ToolContext, subset?: Partial<ToolContext>): boolean {
	if (!subset) return false;
	const hasAny = Object.values(subset).some((value) => value !== undefined);
	if (!hasAny) return false;

	for (const rawKey of Object.keys(subset)) {
		const key = rawKey as keyof ToolContext;
		const expected = subset[key];
		if (expected === undefined) continue;

		const actual = context[key];

		if (key === "features") {
			const need = expected as string[];
			const have = actual as string[] | undefined;
			if (!have || !need.every((feat) => have.includes(feat))) return false;
			continue;
		}

		if (key === "fileContext") {
			if (!subsetMatchesFileClassification(actual as FileClassification | undefined, expected as Partial<FileClassification>))
				return false;
			continue;
		}

		if (actual !== expected) return false;
	}

	return true;
}

function subsetMatchesFileClassification(actual: FileClassification | undefined, expect: Partial<FileClassification>): boolean {
	if (!actual) return false;
	for (const [fk, fv] of Object.entries(expect)) {
		if (fv === undefined) continue;
		if ((actual as Record<string, unknown>)[fk] !== fv) return false;
	}
	return true;
}

function satisfiesBinaries(binaryAvailability: BinaryAvailabilitySnapshot | undefined, required?: string[]): boolean {
	if (!required?.length) return true;
	if (!binaryAvailability?.byBinary) return false;
	return required.every((name) => binaryAvailability.byBinary[name]?.available === true);
}

/** Hard requirements for default routing when no explicit rule matches (optional tools stay empty). */
function primaryBinaryNeeds(tool: PiSherlockToolName | string): string[] {
	switch (tool) {
		case "search":
		case "concept_search":
		case "ripgrep":
			return ["rg"];
		case "find_files":
			return ["fd"];
		case "fuzzy_find":
			return ["fzf"];
		case "semgrep":
			return ["semgrep"];
		case "ast_grep":
			return ["ast-grep"];
		case "count_lines":
			return ["tokei"];
		case "find_duplicates":
			return ["jscpd"];
		default:
			return [];
	}
}

export class DecisionEngine {
	private readonly rules: RoutingRule[];

	constructor(rules?: RoutingRule[]) {
		this.rules = rules ?? this.defaultRules();
	}

	decide(context: ToolContext): RoutingDecision {
		const applicable = this.rules
			.filter((rule) => contextMatchesSubset(context, rule.conditions))
			.filter((rule) => !contextMatchesSubset(context, rule.blockingConditions))
			.filter((rule) => satisfiesBinaries(context.binaryAvailability, rule.requiredBinaries))
			.sort((a, b) => b.priority - a.priority);

		if (applicable.length === 0) {
			return this.defaultDecision(context);
		}

		const primaryRule = applicable[0];
		const secondaryRules = applicable.slice(1, 4).filter((r) => r.tool !== primaryRule.tool);

		const confidence = this.calculateConfidence(applicable, context);

		const decision: RoutingDecision = {
			primaryTool: primaryRule.tool,
			secondaryTools: secondaryRules.map((r) => r.tool),
			confidence,
			reasoning: this.buildReasoning(context, primaryRule, applicable.slice(1, 4)),
			fallbacks: this.getFallbacks(primaryRule.tool),
		};
		if (primaryRule.requiredBinaries?.length) {
			decision.binaryRequirements = [...primaryRule.requiredBinaries];
		}
		const enhanced = secondaryRules.find((r) => r.enhancedAlternative)?.enhancedAlternative;
		if (enhanced) {
			decision.enhancedFeatures = [enhanced];
		}
		return decision;
	}

	exportRulesSnapshot(): RoutingRule[] {
		return [...this.rules].sort((a, b) => b.priority - a.priority);
	}

	private defaultDecision(context: ToolContext): RoutingDecision {
		let primary = INTENT_DEFAULT_PRIMARY[context.intent] ?? ("search" as PiSherlockToolName);

		// Respect missing binaries without overfitting local environments.
		if (!satisfiesBinaries(context.binaryAvailability, primaryBinaryNeeds(primary))) {
			const fb = TOOL_FALLBACKS[primary] ?? [];
			for (const cand of fb) {
				if (satisfiesBinaries(context.binaryAvailability, primaryBinaryNeeds(cand))) {
					const prev = primary;
					primary = cand;
					return {
						primaryTool: primary,
						secondaryTools: [prev],
						confidence: 0.42,
						reasoning: [
							"No routing rule fired; defaulted from intent.",
							`Adjusted primary from '${prev}' to '${primary}' due to unavailable binaries.`,
						],
						fallbacks: this.getFallbacks(primary),
					};
				}
			}
		}

		return {
			primaryTool: primary,
			secondaryTools: [],
			confidence: 0.41,
			reasoning: ["No routing rule matched; defaulted from dominant intent heuristic."],
			fallbacks: this.getFallbacks(primary),
			binaryRequirements: primaryBinaryNeeds(primary),
		};
	}

	private calculateConfidence(applicableSorted: RoutingRule[], context: ToolContext): number {
		let score = 0.62;
		if (applicableSorted[0]?.priority !== undefined) {
			score += Math.min(applicableSorted[0].priority / 5000, 0.26);
		}
		score += 0.035 * Math.min(applicableSorted.length - 1, 3);
		if (context.binaryAvailability && applicableSorted[0]?.requiredBinaries?.length) {
			const allSat = satisfiesBinaries(context.binaryAvailability, applicableSorted[0].requiredBinaries);
			if (!allSat) score -= 0.12;
		}
		return Math.min(0.97, Number(score.toFixed(3)));
	}

	private buildReasoning(context: ToolContext, winner: RoutingRule, runnersUp: RoutingRule[]): string[] {
		const chunks: string[] = [
			`Matched '${winner.tool}' (priority=${winner.priority}) for intent '${context.intent}', specificity '${context.specificity}', scope '${context.scope}'.`,
		];
		if (winner.requiredBinaries?.length) {
			chunks.push(`Prefers binaries: ${winner.requiredBinaries.join(", ")}.`);
		}
		if (runnersUp.length > 0) {
			chunks.push(`Alternate candidates consider: ${runnersUp.map((r) => `${r.tool}(${r.priority})`).join(", ")}.`);
		}
		return chunks;
	}

	private getFallbacks(tool: string): PiSherlockToolName[] {
		return [...(TOOL_FALLBACKS[tool] ?? [])];
	}

	private defaultRules(): RoutingRule[] {
		const I = {
			search: "search" as ToolIntent,
			find: "find" as ToolIntent,
			analyze: "analyze" as ToolIntent,
			count: "count" as ToolIntent,
			refactor: "refactor" as ToolIntent,
			read: "read" as ToolIntent,
			write: "write" as ToolIntent,
			edit: "edit" as ToolIntent,
			shell: "shell" as ToolIntent,
			list: "list" as ToolIntent,
		};
		const S = {
			conceptual: "conceptual" as SpecificityKind,
			exact: "exact" as SpecificityKind,
			fuzzy: "fuzzy" as SpecificityKind,
			structural: "structural" as SpecificityKind,
		};
		const C = {
			structure: "structure" as ScopeKind,
		};

		return [
			{
				tool: "find_duplicates",
				priority: 980,
				conditions: { features: ["duplicate-detection"] },
				requiredBinaries: ["jscpd"],
			},
			{
				tool: "find_duplicates",
				priority: 970,
				conditions: { intent: I.refactor },
				requiredBinaries: ["jscpd"],
			},
			{
				tool: "count_lines",
				priority: 960,
				conditions: { intent: I.count },
				requiredBinaries: ["tokei"],
			},
			{
				tool: "shell_enhanced",
				priority: 954,
				conditions: { intent: I.shell, features: ["structured-shell"] },
			},
			{
				tool: "shell_enhanced",
				priority: 952,
				conditions: { intent: I.shell },
			},
			{
				tool: "read_enhanced",
				priority: 938,
				conditions: { intent: I.read, features: ["structure-aware-read"] },
				requiredBinaries: ["ast-grep"],
			},
			{
				tool: "read_enhanced",
				priority: 932,
				conditions: {
					intent: I.read,
					fileContext: { type: FileType.CODE },
				},
				enhancedAlternative: "Ast-grep-assisted read when file is code",
				requiredBinaries: ["ast-grep"],
			},

			{
				tool: "edit_enhanced",
				priority: 935,
				conditions: { intent: I.edit, features: ["ast-edit-preview"] },
				requiredBinaries: ["ast-grep"],
			},

			{
				tool: "edit_enhanced",
				priority: 928,
				conditions: { intent: I.edit, fileContext: { type: FileType.CODE } },
				requiredBinaries: ["ast-grep"],
			},

			{
				tool: "edit_enhanced",
				priority: 923,
				conditions: { intent: I.edit },
			},

			{
				tool: "write_enhanced",
				priority: 926,
				conditions: { intent: I.write },
			},

			{
				tool: "read_enhanced",
				priority: 925,
				conditions: { intent: I.read },
			},

			{
				tool: "ls_enhanced",
				priority: 921,
				conditions: { intent: I.list, features: ["repo-topology"] },
			},
			{
				tool: "ls_enhanced",
				priority: 918,
				conditions: { intent: I.list },
			},

			{
				tool: "ripgrep",
				priority: 910,
				conditions: { intent: I.search, features: ["ripgrep-advanced"] },
				requiredBinaries: ["rg"],
			},
			{
				tool: "semgrep",
				priority: 905,
				conditions: { intent: I.analyze, features: ["security-audit"] },
				requiredBinaries: ["semgrep"],
			},
			{
				tool: "semgrep",
				priority: 901,
				conditions: { intent: I.analyze, specificity: S.structural, scope: C.structure },
				blockingConditions: { patternType: "ast" },
				requiredBinaries: ["semgrep"],
			},
			{
				tool: "ast_grep",
				priority: 904,
				conditions: { intent: I.analyze, patternType: "ast" },
				requiredBinaries: ["ast-grep"],
			},
			{
				tool: "ast_grep",
				priority: 876,
				conditions: { intent: I.analyze },
				requiredBinaries: ["ast-grep"],
			},
			{
				tool: "concept_search",
				priority: 890,
				conditions: { intent: I.search, specificity: S.conceptual },
				blockingConditions: { specificity: S.exact },
				requiredBinaries: ["rg"],
			},

			{
				tool: "search",
				priority: 880,
				conditions: { intent: I.search },
				requiredBinaries: ["rg"],
				blockingConditions: { specificity: S.conceptual },
			},

			{
				tool: "fuzzy_find",
				priority: 860,
				conditions: { intent: I.find, specificity: S.fuzzy },
				requiredBinaries: ["fzf"],
			},
			{
				tool: "find_files",
				priority: 850,
				conditions: { intent: I.find },
				requiredBinaries: ["fd"],
			},
		];
	}
}
