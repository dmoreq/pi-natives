/**
 * Shared schema fragments and complete tool schemas.
 *
 * Reusable schema fields eliminate duplication between `search` and `ripgrep` schemas,
 * and between `fzf` and `fd` schemas.
 */
import { Type } from "typebox";

// ── Shared schema fragments ────────────────────────────────────────

/** Common path field used by all tools. */
export const pathField = Type.Optional(
	Type.String({
		description: "File or directory to search (defaults to workspace root)",
		examples: ["src/", "src/foo.ts"],
	}),
);

/** Common glob filter field. */
export const globField = Type.Optional(
	Type.String({ description: "Glob filter for filenames", examples: ["*.ts", "*.py"] }),
);

/** Common file type alias field. */
export const typeField = Type.Optional(
	Type.String({ description: "File type alias", examples: ["js", "py", "rust"] }),
);

/** Common context before field. */
export const contextBeforeField = Type.Optional(
	Type.Integer({ description: "Context lines before match", default: 0 }),
);

/** Common context after field. */
export const contextAfterField = Type.Optional(
	Type.Integer({ description: "Context lines after match", default: 0 }),
);

/** Common max count / limit field. */
export const maxCountField = Type.Optional(
	Type.Integer({ description: "Maximum matches to return", default: 20 }),
);

/** Common skip / offset field. */
export const skipField = Type.Optional(
	Type.Number({ description: "Matches to skip", default: 0 }),
);

/** Pattern field (required for regex-based tools). */
export const patternField = Type.String({
	description: "Regex pattern to search for",
	examples: ["function\\s+\\w+", "TODO", "error.*timeout"],
});

// ── Complete tool schemas ──────────────────────────────────────────

export const searchSchema = Type.Object({
	pattern: patternField,
	path: Type.String({
		description: "File, directory, or glob pattern to search",
		examples: ["src/", "src/foo.ts", "src/**/*.ts"],
	}),
	i: Type.Optional(Type.Boolean({ description: "Case-insensitive search", default: false })),
	gitignore: Type.Optional(Type.Boolean({ description: "Respect .gitignore", default: true })),
	glob: globField,
	type: typeField,
	skip: skipField,
	maxCount: Type.Optional(Type.Number({ description: "Maximum matches to return", default: 20 })),
	contextBefore: contextBeforeField,
	contextAfter: contextAfterField,
});

export const ripgrepSchema = Type.Object({
	pattern: patternField,
	path: pathField,
	glob: globField,
	type: typeField,
	ignoreCase: Type.Optional(
		Type.Boolean({ description: "Case-insensitive search", default: false }),
	),
	multiline: Type.Optional(
		Type.Boolean({ description: "Enable multiline matching (dot matches newlines)", default: false }),
	),
	hidden: Type.Optional(Type.Boolean({ description: "Include hidden files", default: false })),
	noIgnore: Type.Optional(Type.Boolean({ description: "Ignore .gitignore", default: false })),
	mode: Type.Optional(
		Type.String({
			description: "Output mode: 'content', 'count', or 'filesWithMatches'",
			examples: ["content", "count", "filesWithMatches"],
		}),
	),
	contextBefore: contextBeforeField,
	contextAfter: contextAfterField,
	maxCount: Type.Optional(Type.Integer({ description: "Maximum matches to return", default: 50 })),
	skip: skipField,
	fixedStrings: Type.Optional(
		Type.Boolean({ description: "Treat pattern as literal string, not regex", default: false }),
	),
	timeoutMs: Type.Optional(Type.Integer({ description: "Timeout in milliseconds", default: 0 })),
	maxColumns: Type.Optional(Type.Integer({ description: "Truncate lines to this many characters" })),
});

export const semgrepSchema = Type.Object({
	pattern: Type.Optional(
		Type.String({
			description: "Semgrep pattern expression (e.g. 'eval(...)', '$X == $X')",
			examples: ["eval(...)", "$X == $X", "$F(...)  -->  $F.new(...)"],
		}),
	),
	config: Type.Optional(
		Type.String({
			description:
				'Semgrep rule config: "auto", rule pack ("p/default", "p/r2c-security-audit"), or path to rule file',
			examples: ["auto", "p/default", "p/r2c-security-audit"],
		}),
	),
	path: pathField,
	language: Type.Optional(
		Type.String({
			description: "Target language (required for pattern mode, e.g. 'ts', 'py', 'java', 'go', 'rs')",
			examples: ["ts", "py", "java", "go", "rs"],
		}),
	),
	severity: Type.Optional(
		Type.String({
			description: "Minimum severity filter (ERROR, WARNING, or INFO)",
			examples: ["WARNING", "ERROR"],
		}),
	),
});

export const fzfSchema = Type.Object({
	query: Type.String({
		description: "Fuzzy search query for file paths",
		examples: ["auth middleware", "db config", "api route"],
	}),
	path: pathField,
	glob: globField,
	limit: Type.Optional(Type.Integer({ description: "Maximum number of results to return", default: 20 })),
});

export const fdSchema = Type.Object({
	pattern: Type.Optional(
		Type.String({
			description: "Regex pattern for filename matching (empty = list all)",
			examples: ["middleware", "config", ".*\\.ts$"],
		}),
	),
	path: pathField,
	glob: globField,
	extension: Type.Optional(
		Type.String({
			description: "File extension filter (e.g. 'ts', 'py', 'md')",
			examples: ["ts", "py", "md"],
		}),
	),
	type: Type.Optional(
		Type.String({
			description: "File type filter: 'file', 'directory', or 'symlink'",
			examples: ["file", "directory"],
		}),
	),
	hidden: Type.Optional(Type.Boolean({ description: "Include hidden files and directories", default: false })),
	noIgnore: Type.Optional(Type.Boolean({ description: "Do not respect .gitignore", default: false })),
	maxResults: Type.Optional(
		Type.Integer({ description: "Maximum number of results to return", default: 50 }),
	),
	caseSensitive: Type.Optional(Type.Boolean({ description: "Case-sensitive matching", default: false })),
});

export const bm25Schema = Type.Object({
	query: Type.String({
		description: "Natural language or keyword query",
		examples: ["authentication middleware", "database config", "image processing"],
	}),
	paths: Type.Optional(
		Type.Array(Type.String({ description: "File paths to search (uses cwd if empty)" }), {
			description: "File paths to index and search",
		}),
	),
	limit: Type.Optional(Type.Integer({ description: "Maximum number of results to return", default: 10 })),
});

export const astGrepSchema = Type.Object({
	pattern: Type.String({
		description: "AST pattern to match (e.g. 'eval($$$A)', '$O.method($$$ARGS)', '$X == $X')",
		examples: ["eval($$$A)", "$O.method($$$ARGS)", "$X == $X"],
	}),
	language: Type.Optional(
		Type.String({
			description: "Target language for AST parsing (e.g. 'ts', 'py', 'rs', 'go')",
			examples: ["ts", "py", "rs", "go"],
		}),
	),
	path: pathField,
	rewrite: Type.Optional(
		Type.String({
			description: "Replacement string — rewrites matched AST nodes",
			examples: ["newMethod($$$ARGS)"],
		}),
	),
	strictness: Type.Optional(
		Type.String({
			description: "Pattern strictness: 'cst', 'smart', 'ast', 'relaxed', 'signature', or 'template'",
			examples: ["smart", "ast", "relaxed"],
		}),
	),
	follow: Type.Optional(
		Type.Boolean({ description: "Follow symbolic links while traversing directories", default: false }),
	),
});

export const tokeiSchema = Type.Object({
	paths: Type.Optional(
		Type.Array(Type.String({ description: "Paths to files or directories to count" }), {
			description: "Paths to count (defaults to workspace root)",
		}),
	),
	files: Type.Optional(
		Type.Boolean({ description: "Show per-file statistics", default: false }),
	),
	exclude: Type.Optional(
		Type.Array(Type.String({ description: "Exclude files/directories matching these patterns" }), {
			description: "Glob patterns to exclude",
			examples: [["node_modules", "dist", ".git"]],
		}),
	),
	hidden: Type.Optional(
		Type.Boolean({ description: "Count hidden files", default: false }),
	),
	noIgnore: Type.Optional(
		Type.Boolean({ description: "Don't respect ignore files (.gitignore, .ignore)", default: false }),
	),
	types: Type.Optional(
		Type.Array(Type.String({ description: "Language name" }), {
			description: "Filter by language types (e.g. ['Rust', 'TypeScript'])",
			examples: [["Rust", "TypeScript"]],
		}),
	),
	sort: Type.Optional(
		Type.String({
			description: "Sort by column: 'files', 'lines', 'blanks', 'code', or 'comments'",
			examples: ["code", "files"],
		}),
	),
	reverseSort: Type.Optional(
		Type.Boolean({ description: "Reverse sort order", default: false }),
	),
});

export const jscpdSchema = Type.Object({
	paths: Type.Optional(
		Type.Array(Type.String({ description: "Paths to scan for duplicates" }), {
			description: "Paths to scan (defaults to workspace root)",
		}),
	),
	minLines: Type.Optional(
		Type.Integer({ description: "Minimum duplicated lines to report (default: 5)", default: 5 }),
	),
	minTokens: Type.Optional(
		Type.Integer({ description: "Minimum duplicated tokens to report (default: 50)", default: 50 }),
	),
	mode: Type.Optional(
		Type.String({
			description: "Detection mode: 'strict' (exact clones), 'mild' (near-duplicates), or 'weak' (loose matching)",
			examples: ["strict", "mild", "weak"],
		}),
	),
	ignore: Type.Optional(
		Type.Array(Type.String({ description: "Glob pattern to ignore" }), {
			description: "Glob patterns for files/dirs to exclude (e.g. ['**/*.test.ts', '**/node_modules/**'])",
			examples: [["**/*.test.ts", "**/dist/**"]],
		}),
	),
	format: Type.Optional(
		Type.Array(Type.String({ description: "Language format name" }), {
			description: "Filter by language formats (e.g. ['typescript', 'python'])",
			examples: [["typescript", "python"]],
		}),
	),
});
