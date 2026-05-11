/**
 * Type definitions for AST editor
 */

export interface AstEditOptions {
	path: string;
	pattern: string;
	replacement: string;
	preview?: boolean;
	/** When absent, defaults to true for writes and false during preview-only runs. */
	backup?: boolean;
	nodeType?: "function" | "class" | "method" | "variable" | "generic";
	/**
	 * Only **`file`** (default when omitted) is implemented: patterns run across the whole file.
	 *
	 * **`function`** and **`class`** remain **reserved** for future nested-scope rewrites — they behave like **`file`** today, and callers receive {@link AstEditResult.warnings} noting that limitation.
	 */
	scope?: "file" | "function" | "class";
	cwd?: string;
}

export interface AstChange {
	/** Matched range start line (0-based, editor-style). */
	line?: number;
	column?: number;
	/** Source text before rewrite. */
	before?: string;
	/** Replacement text ast-grep would apply. */
	after?: string;
}

export interface AstEditResult {
	/** Changed content (only populated during preview mode). */
	preview?: string;
	/** Summary of the edit operation. */
	summary: string;
	/** Number of matches found and replaced. */
	matchCount: number;
	/** Backward compatibility alias for matchCount. */
	totalChanges: number;
	/** Individual changes (only during preview mode). */
	changes?: AstChange[];
	/** Method used for editing: "ast-grep" | "native-string". */
	method: string;
	/** Warnings about unsupported features or fallbacks. */
	warnings: string[];
	/** Path to backup file (if created). */
	backupPath?: string;
	/** Backward compatibility: syntax validation result. */
	syntaxValid?: boolean;
	/** Backward compatibility: preview diff content. */
	previewDiff?: string;
}

export interface AstGrepSpawnOpts {
	pattern: string;
	replacement: string;
	filePath: string;
	language?: string;
	cwd?: string;
}

export interface AstFileEditorOptions {
	/**
	 * ast-grep binary path. When absent, resolved via PATH.
	 */
	astGrepPath?: string;
	/**
	 * Working directory for spawned processes.
	 */
	cwd?: string;
}

export interface AstGrepSpawnResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}