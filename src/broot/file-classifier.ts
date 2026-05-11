/**
 * File classification for broot topology
 * 
 * TODO: This should eventually migrate to use the unified FileTypeRegistry
 * from src/core/file-type-registry.ts for consistency across the codebase.
 */

import type { DirectoryKind, FileCategory, DirectoryNode } from "./types";

const CODE_EXTS = new Set([
	"ts", "js", "tsx", "jsx", "py", "rs", "go", "java", "kt", "cs", "php", "rb", "swift", "c", "cpp", "h", "hpp"
]);
const MARKUP_EXTS = new Set(["html", "htm", "md", "mdx", "rst", "adoc"]);
const DOC_EXTS = new Set(["txt", "log"]);
const CONFIG_EXTS = new Set(["json", "yaml", "yml", "toml", "ini", "cfg", "conf"]);
const DATA_EXTS = new Set(["csv", "tsv", "xml"]);

/**
 * Categorize file by extension
 */
export function categorizeExtension(extension: string): FileCategory {
	if (CODE_EXTS.has(extension)) return "code";
	if (MARKUP_EXTS.has(extension)) return "markup";
	if (DOC_EXTS.has(extension)) return "doc";
	if (CONFIG_EXTS.has(extension)) return "config";
	if (DATA_EXTS.has(extension)) return "data";
	return "unknown";
}

/**
 * Classify a node by name and kind, extracting extension and category
 */
export function classifyNode(name: string, kind: DirectoryKind): Pick<DirectoryNode, "extension" | "fileCategory"> {
	if (kind !== "file") return {};
	
	const lastDot = name.lastIndexOf(".");
	if (lastDot <= 0) return { fileCategory: "unknown" };
	
	const extension = name.slice(lastDot + 1).toLowerCase();
	const fileCategory = categorizeExtension(extension);
	
	return { extension, fileCategory };
}