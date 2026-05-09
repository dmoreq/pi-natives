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

export const editEnhancedSchema = Type.Object({
	path: Type.String({
		description: "Path to file to edit (relative to workspace cwd or absolute)",
		examples: ["src/app.ts", "README.md"],
	}),
	pattern: Type.String({
		description:
			"For code files with ast-grep: AST pattern (metavariables like $VAR, $$$REST). For non-code/native fallback: exact literal substring.",
		examples: ["const $X = $Y", "OLD_TOKEN"],
	}),
	replacement: Type.String({
		description: "Rewrite template (mirrors ast-grep `-r`) or literal replacement text for native mode",
		examples: ["let $X = $Y", "NEW_TOKEN"],
	}),
	preview: Type.Optional(
		Type.Boolean({
			description:
				"Dry-run: show ast-grep diff or native pseudo-diff without writing. Skips backups when true.",
			default: false,
		}),
	),
	backup: Type.Optional(
		Type.Boolean({
			description:
				"Snapshot existing bytes to `{path}.bak.{timestamp}` before applying (recommended for production edits). Ignored during preview-only runs.",
			default: true,
		}),
	),
	nodeType: Type.Optional(
		Type.Union(
			[
				Type.Literal("function"),
				Type.Literal("class"),
				Type.Literal("method"),
				Type.Literal("variable"),
				Type.Literal("generic"),
			],
			{
				description:
					"Optional `--strictness` hint for ast-grep (`generic`→smart, `function|class|method`→ast); `variable` keeps default strictness so TS declarators still match.",
			},
		),
	),
	scope: Type.Optional(
		Type.Union([Type.Literal("file"), Type.Literal("function"), Type.Literal("class")], {
			description:
				"Granularity hint. **`file`** (implicit default) edits the entire file. **`function`** / **`class`** are RESERVED in this release: they behave like whole-file edits but add a warnings line to the response so tooling knows nested scope is not narrowed yet.",
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description: "Working directory used to resolve relative paths (normally the agent workspace cwd)",
		}),
	),
});

export const writeEnhancedSchema = Type.Object({
	path: Type.String({
		description: "Path to file to write (relative to workspace cwd or absolute)",
		examples: ["src/app.ts", "notes.md", "tmp/output.json"],
	}),
	content: Type.String({
		description: "Full file contents to write or append (UTF-8 text)",
	}),
	mode: Type.Optional(
		Type.Union([Type.Literal("write"), Type.Literal("append")], {
			description: "Replace file (`write`) or append bytes (`append`). Default: write",
		}),
	),
	atomic: Type.Optional(
		Type.Boolean({
			description:
				"Use temp file + rename for replace/append-atomic (default: true for write; default: false for append)",
		}),
	),
	backup: Type.Optional(
		Type.Boolean({
			description: "Before overwrite, copy existing file to `{path}.bak.{timestamp}`",
			default: false,
		}),
	),
	streaming: Type.Optional(
		Type.Boolean({
			description:
				"When atomic and payload is large, stream chunks to the temp file via Bun native writer (reduces peak memory)",
			default: false,
		}),
	),
});

export const readEnhancedSchema = Type.Object({
	path: Type.String({
		description: "Path to file to read (relative to workspace or absolute)",
		examples: ["src/app.ts", "package.json", "config.yaml"],
	}),
	jqQuery: Type.Optional(
		Type.String({
			description: "jq filter for JSON files (default: '.'); only used when file is detected as JSON",
			examples: [".dependencies", ".scripts.build", '.. | .name? | select(. != null)'],
		}),
	),
	yqQuery: Type.Optional(
		Type.String({
			description:
				"yq expression for YAML/TOML/XML/CSV when yq is available (default: '.'; CSV uses `-p csv`)",
			examples: [".spec.replicas", ".tool.poetry", '.[0]', ".name"],
		}),
	),
	maxChars: Type.Optional(
		Type.Integer({ description: "Override max output characters before truncation", default: 10_000 }),
	),
	maxLines: Type.Optional(
		Type.Integer({ description: "Override max output lines before truncation", default: 200 }),
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

export const shellEnhancedSchema = Type.Object({
	command: Type.String({
		description:
			"POSIX shell command to evaluate. Prefer `ls`, `ps`, `env`, `git log`, etc. — the tool enhances these with optional Nushell `| to json` pipelines when `enforceJson` is enabled.",
		examples: ["ls -la src", 'git status', "env", "pwd"],
	}),
	enforceJson: Type.Optional(
		Type.Boolean({
			description:
				"When true (default) and `/nu` exists, wraps known CLI patterns (`ls`, `ps`, `env`, …) in Nushell pipelines that terminate with structured JSON.",
			default: true,
		}),
	),
	timeout: Type.Optional(
		Type.Integer({
			description: "Wall-clock timeout per backend attempt (ms). Applies to Nu, POSIX Bun tier, or bash fallback.",
			default: 120_000,
			minimum: 1,
			maximum: 3_600_000,
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description:
				"Working directory (relative segments resolve against agent workspace cwd; absolute paths are honored verbatim). Default: workspace cwd.",
		}),
	),
	env: Type.Optional(
		Type.Record(Type.String(), Type.String(), {
			description:
				"Extra environment pairs merged into the spawned process (`NU` inherits host env merged with overrides). Values must already be sanitized — no escaping is performed.",
		}),
	),
	fallbackToBun: Type.Optional(
		Type.Boolean({
			description:
				"When true (default), prefer the POSIX fast path spawned via Bun after Nu failures/non-structured output; otherwise fall back straight to `$SHELL`/`bash`-compatible execution.",
			default: true,
		}),
	),
});


export const lsEnhancedSchema = Type.Object({
	path: Type.Optional(
		Type.String({
			description: "Directory to map (defaults to workspace cwd)",
			examples: ["src", ".", ".."],
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description: "Effective workspace root used to resolve relative `path` (defaults to agent workspace cwd)",
		}),
	),
	depth: Type.Optional(
		Type.Integer({
			description: "Maximum recursion depth relative to root (1 = immediate children only). Default: 12",
			default: 12,
			minimum: 1,
			maximum: 128,
		}),
	),
	includeHidden: Type.Optional(Type.Boolean({ description: "Include dot-files and dot-directories", default: false })),
	includeGitStatus: Type.Optional(
		Type.Boolean({ description: "Attach git statusXY per file when root is inside a repo", default: true }),
	),
	filterTypes: Type.Optional(
		Type.Array(Type.String({ description: "Extension ('ts'), category ('code'), or kind ('directory','symlink')" }), {
			description:
				"Filter leaves: omit files that match none (extensions omit leading dot). Categories: code, markup, doc, config, data, unknown. Keep parent dirs that still contain matches.",
			examples: [["ts", "tsx", "directory"], ["code", "config"]],
		}),
	),
	minSizeBytes: Type.Optional(
		Type.Integer({ description: "Only include files with size >= min (bytes)", minimum: 0 }),
	),
	maxSizeBytes: Type.Optional(Type.Integer({ description: "Only include files with size <= max (bytes)", minimum: 0 })),
	preferBroot: Type.Optional(
		Type.Boolean({
			description:
				"When broot/br is available, run `:print_tree` first and try to coerce its ASCII tree into the same JSON topology (fallbacks to filesystem scan on parse failure)",
			default: true,
		}),
	),
});
