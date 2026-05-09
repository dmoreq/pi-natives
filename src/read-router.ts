/**
 * File type detection and routing metadata for structure-aware file reading.
 */
import * as path from "node:path";

// ── Types ───────────────────────────────────────────────────────────

export type FileType = "code" | "data" | "text";

/** High-level language bucket for routing and ast-grep `-l`; not exhaustive.
 * JVM-style sources use **`java`**; **`kotlin`** and **`csharp`** are distinct.
 */
export type CodeLanguage =
	| "typescript"
	| "javascript"
	| "python"
	| "rust"
	| "go"
	| "java"
	| "kotlin"
	| "csharp"
	| "other";

export type DataFormat = "json" | "yaml" | "toml" | "xml" | "csv";

export interface DetectionResult {
	fileType: FileType;
	codeLanguage?: CodeLanguage;
	dataFormat?: DataFormat;
}

/** Result of a smart read — metadata plus body text for the agent. */
export interface EnhancedReadResult {
	content: string;
	method:
		| "ast-grep"
		| "bat"
		| "jq"
		| "yq-mikefarah"
		| "yq-other"
		| "native-json"
		| "native-yaml-text"
		| "native-csv-text"
		| "native-text";
	fileType: FileType;
	codeLanguage?: CodeLanguage;
	dataFormat?: DataFormat;
	estimatedTokens: number;
	readTimeMs: number;
	fileSizeBytes: number;
	fallbacks: string[];
}

// ── Detector ───────────────────────────────────────────────────────

const CODE_EXTENSIONS: Record<string, CodeLanguage> = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	py: "python",
	pyw: "python",
	rs: "rust",
	go: "go",
	java: "java",
	kt: "kotlin",
	kts: "kotlin",
	cs: "csharp",
	cpp: "other",
	cc: "other",
	cxx: "other",
	hpp: "other",
	h: "other",
	c: "other",
	swift: "other",
	rb: "other",
	php: "other",
	scala: "other",
	vue: "typescript",
	svelte: "typescript",
};

const DATA_EXTENSIONS: Record<string, DataFormat> = {
	json: "json",
	jsonc: "json",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	xml: "xml",
	csv: "csv",
};

export class FileTypeDetector {
	detect(filePath: string): DetectionResult {
		const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();

		if (ext && DATA_EXTENSIONS[ext]) {
			return { fileType: "data", dataFormat: DATA_EXTENSIONS[ext] };
		}

		if (ext && CODE_EXTENSIONS[ext]) {
			const codeLanguage = CODE_EXTENSIONS[ext];
			return { fileType: "code", codeLanguage };
		}

		return { fileType: "text" };
	}
}

// ── ast-grep `-l` language ids ─────────────────────────────────────

/**
 * Map a code file path to ast-grep's `-l` language argument.
 */
export function astGrepLanguageForFile(
	filePath: string,
	codeLanguage: CodeLanguage | undefined,
): string | undefined {
	if (!codeLanguage || codeLanguage === "other") return undefined;

	const ext = path.extname(filePath).toLowerCase();

	if (codeLanguage === "typescript") {
		return ext === ".tsx" ? "tsx" : "ts";
	}
	if (codeLanguage === "javascript") {
		return ext === ".jsx" ? "jsx" : "js";
	}

	const byLang: Partial<Record<CodeLanguage, string>> = {
		python: "py",
		rust: "rust",
		go: "go",
		java: "java",
		kotlin: "kotlin",
		csharp: "csharp",
	};
	return byLang[codeLanguage];
}

/**
 * Skeleton query patterns per language — function signatures and class shells.
 */
export function codeSkeletonPatterns(codeLanguage: CodeLanguage, filePath: string): string[] {
	const ext = path.extname(filePath).toLowerCase();
	const isTs = codeLanguage === "typescript" || codeLanguage === "javascript";
	const isPy = codeLanguage === "python";
	const isRust = codeLanguage === "rust";
	const isGo = codeLanguage === "go";
	const isJava = codeLanguage === "java";
	const isKotlin = codeLanguage === "kotlin";
	const isCsharp = codeLanguage === "csharp";

	const patterns: string[] = [];

	if (isTs) {
		patterns.push("export function $NAME($$$PARAMS): $RET { $$$ }");
		patterns.push("export function $NAME($$$PARAMS) { $$$ }");
		patterns.push("function $NAME($$$PARAMS) { $$$ }");
		if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
			patterns.push("class $CLASS { $$$ }");
		}
	}

	if (isPy) {
		patterns.push("def $NAME($$$PARAMS): $$$");
		patterns.push("class $CLASS: $$$");
	}

	if (isRust) {
		patterns.push("fn $NAME($$$PARAMS) $$$");
		patterns.push("impl $$$ { $$$ }");
	}

	if (isGo) {
		patterns.push("func $NAME($$$PARAMS) $$$");
	}

	if (isJava) {
		patterns.push("class $CLASS { $$$ }");
	}

	if (isKotlin) {
		patterns.push("fun $NAME($$$PARAMS) $$$");
		patterns.push("class $CLASS { $$$ }");
	}

	if (isCsharp) {
		patterns.push("class $CLASS { $$$ }");
	}

	return patterns;
}
