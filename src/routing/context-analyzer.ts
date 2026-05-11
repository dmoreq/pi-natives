/**
 * Query → ToolContext synthesis using binary availability and optional file classification.
 */

import type { BinaryAvailabilitySnapshot, ToolContext, ToolIntent } from "./types";
import { FileTypeRegistry, FileType } from "../core/file-type-registry";
import { BinaryManager, createBinaryRequirements } from "../core/binary-manager";

/** Classifies a path into {@link FileClassification} (delegates to FileTypeRegistry). */
export type FileTypeClassifier = {
	classify(path: string): FileClassification;
};

/** Default classifier maps to {@link FileTypeRegistry.classify}. */
export const defaultFileTypeClassifier: FileTypeClassifier = {
	classify(filePath: string): FileClassification {
		return FileTypeRegistry.classify(filePath);
	},
};

/** Snapshot availability for binaries declared in {@link createBinaryRequirements}. */
export function snapshotBinaryAvailability(manager: BinaryManager): BinaryAvailabilitySnapshot {
	const reqs = Object.values(createBinaryRequirements());
	const byBinary: BinaryAvailabilitySnapshot["byBinary"] = {};
	for (const req of reqs) {
		const result = manager.isAvailable(req);
		byBinary[result.binary] = {
			available: result.available,
			error: result.error,
		};
	}
	return { byBinary };
}

export class ContextAnalyzer {
	constructor(
		private readonly binaryManager: BinaryManager,
		private readonly fileClassifier: FileTypeClassifier = defaultFileTypeClassifier,
	) {}

	analyzeQuery(query: string, filePath?: string): ToolContext {
		const intent = this.detectIntent(query);
		const specificity = this.detectSpecificity(query, intent);
		const scope = this.detectScope(query, intent);
		const hasPattern = this.detectPattern(query);
		const performancePreference = this.detectPerformancePreference(query);
		const features = this.detectRequiredFeatures(query);

		return {
			intent,
			specificity,
			scope,
			hasPattern,
			patternType: hasPattern ? this.detectPatternType(query) : undefined,
			features: features.length > 0 ? features : undefined,
			fileContext: filePath !== undefined ? this.fileClassifier.classify(filePath) : undefined,
			binaryAvailability: snapshotBinaryAvailability(this.binaryManager),
			performancePreference,
		};
	}

	private detectIntent(query: string): ToolIntent {
		const q = query.trim();

		if (/duplicate\s+code|find_duplicates|\bjscpd\b|copy.?paste|cloned?\s+(block|snippet)/i.test(q))
			return "refactor";

		if (/\b(lines?\s+of\s+code|loc\b|metrics|statistics|stats|tokei|count_lines\b)/i.test(q))
			return "count";

		if (/analyze|audit|security|SAST\b|CVE\b|\bOwasp\b|bug\s+hunt|\bSemgrep\b/i.test(q)) return "analyze";

		if (/edit|modify|\bpatch\b|change\s+every|replace\s+all\s+instances|rewrite\s+syntax|syntax.?aware/i.test(q))
			return "edit";

		if (/create\s+new\s+file|write_enhanced|atomic\s+write|save\s+(to\s+)?file|overwrite\s+file/i.test(q))
			return "write";

		if (/read_enhanced|smart\s+read|syntax\s+h(y|ighlight)|slice\b.*json|\bjq\b.*field|\bfold\b\s+regions/i.test(q))
			return "read";

		if (/shell_enhanced|structured\s+json|run\s+(with\s+)?json|from\s+json|\bnushell\b|^nu\b/i.test(q))
			return "shell";

		if (/ls_enhanced|repository\s+structure|\btopology\b|\bprint_tree\b|tree\s+(view|outline)|directories?\s+overview/i.test(q))
			return "list";

		const conceptualPhrase =
			/\bconcept_search\b|\banything\s+(about|on)|authentication\s+related|ideas?\s+around|tell\s+me\s+where/i.test(q) ||
			/related\s+to.{0,80}\bcodes?\b/i.test(q);
		if (conceptualPhrase) return "search";

		const looksLikeFileFinding =
			/\b(find_files|fuzzy_find)\b|\b(list|enumerate|discover)\s+(all\s+)?(files|paths)|file\s+names?\s+matching|\bpathname\b|\bglob\b|[*?]\s*(extension|glob|suffix|pattern)/i.test(
				q,
			) ||
			(/find\b/.test(q) &&
				/\b(files?|paths?|directories?|tsx?|\btsx?\b|suffix|extension|named|matching)\b/i.test(q)) ||
			(/find\b/.test(q) && /\b(might\s+be|called\s+similar|approximately|somewhat|similar\b)/i.test(q));

		const mentionsContentProbe =
			/\b(string|snippet|matching\s+text|inside\s+(the\s+)?file|contents?\b|\bmentions?\s+of|implementations?\b|regex|literal)\b/i.test(q);

		if (looksLikeFileFinding && !mentionsContentProbe) return "find";

		if (/search\b|grep|concept_search|matching\s+(lines|hits)|literal\s+\w+/i.test(q)) return "search";

		if (/shell|command\b|bash|script\b|^run\b|execute\b/i.test(q)) return "shell";

		if (/\blist\b|ls\b|dir\b|directory\b|directories\b|^tree\b/i.test(q)) return "list";

		return "find";
	}

	private detectSpecificity(query: string, intent: ToolIntent): ToolContext["specificity"] {
		const q = query;
		if (
			intent === "analyze" &&
			/ast.?grep|\$[A-Za-z_]|\bmetavar\b|grammar|syntax\s+pattern|rewrite\s+capture/i.test(q)
		)
			return "structural";

		if (/\bfuzzy\b|approximately|might\s+be\s+called|not\s+sure\s+(of\s+)?the\s+name|somewhat|similar\s+(to\s+)?name/i.test(q))
			return "fuzzy";

		if (
			intent === "search" &&
			/relevance|\bconceptual\b|\bideas?\b|topics?|themes?|meaning|related\s+to|anything\s+(about|on)\b|^about\b/i.test(
				q,
			)
		)
			return "conceptual";

		const hasRgHint =
			this.detectPattern(query) &&
			/\b(exact|precise|regex|pattern|PCRE|literal\b)/i.test(q);
		if (hasRgHint) return "exact";

		return this.detectPattern(query) ? "exact" : "conceptual";
	}

	private detectScope(query: string, intent: ToolIntent): ToolContext["scope"] {
		const q = query;
		if (/\btoken\b|routing|preference|speed\b|latency/i.test(q) && intent !== "analyze") return "operations";

		if (intent === "count" || /metrics|statistics|distribution|comment\s+ratio/i.test(q)) return "metrics";

		if (/security|duplicate|coverage|architecture|call\s?graph|SAST\b/i.test(q)) return "structure";

		if (/file|directory|path|glob|suffix|rename|locations?\b/i.test(q) || intent === "find" || intent === "list")
			return "files";

		return "content";
	}

	private detectPattern(query: string): boolean {
		return (
			/\\[dDsSwW]|\\b|\\d\+|\(.*\?\)|\(\?:|\\x[0-9a-f]{2}|PCRE|PATTERN/i.test(query) ||
			(/\b(regex|regexp|pattern\s+matching|literal\b)\b/i.test(query) && /\S{2}/.test(query))
		);
	}

	private detectPatternType(query: string): NonNullable<ToolContext["patternType"]> {
		const q = query;
		if (/\bast[_-]?grep|\bAST\b|\$[A-Za-z_]|rewrite|grammar|semgrep.?rule/i.test(q)) return "ast";
		if (/(?:^|[\s/])[^\s\\/]*\*|(?:^|[\s/])[^\s\\/]*\?|\*\*|[\s/](?:src|[*?])\/\*(?:\/|\*\/)|\bglob\b|\*\.tsx?\b|\*\.tsx?$/i.test(q))
		if (/semgrep|SAST\b|conceptual\b|concept_search|themes?|topics?\b/i.test(q)) return "semantic";
		if (/natural\s+language|plain\s+english|tell\s+me\s+what/i.test(q)) return "natural";
		return "regex";
	}

	private detectRequiredFeatures(query: string): string[] {
		const feats: string[] = [];
		const q = query;
		
		// Enhanced ripgrep detection
		const ripgrepSignals = [
			/multiline|^\s*-U\b|--multiline|^rg\s+/i,
			/hidden\s+files?|--hidden/i,
			/--no-ignore|skip.*ignored/i,
			/count.?only|--count|^count\b|-c\b|match.*(density|frequency|count)/i,
			/--files-with-matches|files.*matching/i,
			/fixed.?string|--fixed-strings/i,
			/column\s+limit|--max-columns/i,
			/timeout|performance/i,
		];
		
		if (ripgrepSignals.some(sig => sig.test(q))) {
			feats.push("ripgrep-advanced");
			// Also add specific feature types for more granular routing
			if (/multiline|--multiline/i.test(q)) feats.push("multiline");
			if (/hidden|--hidden/i.test(q)) feats.push("hidden");
			if (/count|--count|match.*(density|frequency)/i.test(q)) feats.push("count");
			if (/performance|speed|optimize|fast/i.test(q)) feats.push("performance");
		}
		if (/security|Owasp|SAST\b|CVE\b|\bSemgrep\b|vulnerabilit/i.test(q)) feats.push("security-audit");
		if (/duplicate|jscpd|copy.?paste|clone(d)?\s+block/i.test(q)) feats.push("duplicate-detection");
		if (/smart\b|structured\s+json|^json\b|^nu\b|\bnushell\b|\bshell_enhanced\b/i.test(q)) feats.push("structured-shell");
		if (/skeleton|\bsmart\s+read|AST\b.*skim|\bread_enhanced\b/i.test(q)) feats.push("structure-aware-read");
		if (/topology|topology|printed\s+tree|\bls_enhanced\b|\bbr(out)?\b.*tree/i.test(q)) feats.push("repo-topology");
		if (/preview|rewrite|AST.*edit|\bedit_enhanced\b/i.test(q)) feats.push("ast-edit-preview");
		if (/backup|streaming|large\s+file write|atomic\b|\bwrite_enhanced\b/i.test(q)) feats.push("atomic-write-stream");
		return feats;
	}

	private detectPerformancePreference(query: string): NonNullable<ToolContext["performancePreference"]> {
		if (/fast|quick|\blatency\b|\bspeed\b/i.test(query)) return "speed";
		if (/accurate|precise|thorough|exhaustive/i.test(query)) return "accuracy";
		if (/smart|enhanced|\btokens?\b|routing.?efficiency/i.test(query)) return "token_efficiency";
		return "token_efficiency";
	}

	/** Exported for targeted unit tests against internal heuristics. */
	matchFileKindHints(path: string): { isCodeLike: boolean; isStructuredConfig: boolean } {
		const c = this.fileClassifier.classify(path);
		return {
			isCodeLike: c.type === FileType.CODE,
			isStructuredConfig: c.type === FileType.DATA || c.type === FileType.CONFIG,
		};
	}
}
