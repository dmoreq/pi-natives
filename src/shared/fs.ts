import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TEXT_EXTENSIONS, SKIP_DIRS, DEFAULT_MAX_FILES } from "./constants";

// ── Types ──────────────────────────────────────────────────────────

export interface CollectedFile {
	/** Relative path from root directory. */
	id: string;
	/** File text content (only populated when includeContent is true). */
	text?: string;
}

export interface CollectOptions {
	/** Max files to collect (default: DEFAULT_MAX_FILES). */
	maxFiles?: number;
	/** Whether to read and include file contents (default: false). */
	includeContent?: boolean;
	/** Max file size in bytes for content reading (default: 50000). */
	maxFileSize?: number;
	/**
	 * Filter to only text-like extensions (default: auto — true when includeContent,
	 * false for path-only collection like fzf which should see ALL files).
	 */
	filterByExtension?: boolean;
}

// ── Unified file collector ────────────────────────────────────────

/**
 * Recursively collect file paths (and optionally contents) from a directory.
 *
 * Replaces the duplicated `collectFiles()` in index.ts and `collectFilePaths()` in fzf.ts.
 * - For path-only collection (fzf): `includeContent: false` → collects ALL files
 * - For content collection (BM25): `includeContent: true` → only text-like files
 */
export async function collectFiles(
	dirPath: string,
	rootDir: string,
	options: CollectOptions = {},
	existingFiles?: CollectedFile[],
): Promise<CollectedFile[]> {
	const {
		maxFiles = DEFAULT_MAX_FILES,
		includeContent = false,
		maxFileSize = 50000,
		filterByExtension,
	} = options;

	// By default, filter extensions only when collecting content
	const shouldFilterExt = filterByExtension ?? includeContent;

	const files: CollectedFile[] = existingFiles ?? [];

	if (files.length >= maxFiles) return files;

	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (files.length >= maxFiles) break;
			if (entry.name.startsWith(".")) continue;
			if (SKIP_DIRS.has(entry.name)) continue;

			const fullPath = path.join(dirPath, entry.name);
			if (entry.isDirectory()) {
				await collectFiles(fullPath, rootDir, options, files);
			} else if (entry.isFile()) {
				// Extension filtering: only when collecting content or explicitly requested
				if (shouldFilterExt) {
					const ext = path.extname(entry.name).toLowerCase();
					if (!TEXT_EXTENSIONS.has(ext)) continue;
				}

				const file: CollectedFile = { id: path.relative(rootDir, fullPath) };

				if (includeContent) {
					try {
						const content = await fs.readFile(fullPath, "utf-8");
						if (content.length > 0 && content.length < maxFileSize) {
							file.text = content;
						}
					} catch {
						// skip unreadable files
						continue;
					}
				}

				files.push(file);
			}
		}
	} catch {
		// skip unreadable directories
	}

	return files;
}

/**
 * Collect file paths only (no content) — ALL files regardless of extension.
 * Used by fzf for fuzzy path search.
 */
export async function collectFilePaths(
	dirPath: string,
	rootDir: string,
	maxFiles?: number,
): Promise<string[]> {
	const files = await collectFiles(dirPath, rootDir, {
		maxFiles,
		includeContent: false,
		filterByExtension: false,
	});
	return files.map(f => f.id);
}

/**
 * Collect files with content for BM25 indexing — text-like files only.
 */
export async function collectFilesWithContent(
	dirPath: string,
	rootDir: string,
	maxFiles?: number,
): Promise<Array<{ id: string; text: string }>> {
	const files = await collectFiles(dirPath, rootDir, {
		maxFiles,
		includeContent: true,
		filterByExtension: true,
	});
	return files
		.filter((f): f is { id: string; text: string } => typeof f.text === "string" && f.text.length > 0)
		.map(f => ({ id: f.id, text: f.text }));
}
