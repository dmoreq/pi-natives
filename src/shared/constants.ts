/**
 * Shared constants used across pi-sherlock tools.
 */

/** Extensions considered text-like for BM25 indexing and file collection. */
export const TEXT_EXTENSIONS = new Set([
	".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
	".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".hpp",
	".md", ".mdx", ".txt", ".json", ".yaml", ".yml", ".toml",
	".css", ".scss", ".html", ".xml", ".svg",
	".sh", ".bash", ".zsh", ".fish",
	".sql", ".graphql", ".prisma",
	".rb", ".php", ".swift", ".kt", ".scala",
	".zig", ".nim", ".ex", ".exs",
	".svelte", ".vue", ".astro",
	".cfg", ".conf", ".ini", ".env",
]);

/** Directory names to skip during file collection. */
export const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	".hg",
	".svn",
]);

/** Max files to collect during directory traversal. */
export const DEFAULT_MAX_FILES = 200;
