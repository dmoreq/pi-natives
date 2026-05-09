/**
 * Type definitions for broot topology mapping
 */

export type DirectoryKind = "file" | "directory" | "symlink";

export type FileCategory = "code" | "markup" | "doc" | "config" | "data" | "unknown";

export interface DirectoryNode {
	name: string;
	relPath: string;
	kind: DirectoryKind;
	extension?: string;
	sizeBytes?: number;
	fileCategory?: FileCategory;
	gitStatus?: string;
	children?: DirectoryNode[];
}

export interface BrootOptions {
	path: string;
	depth?: number;
	includeHidden?: boolean;
	includeGitStatus?: boolean;
	filterTypes?: string[];
	minSizeBytes?: number;
	maxSizeBytes?: number;
	preferBroot?: boolean;
	cwd?: string;
}

export interface BrootResult {
	topology: DirectoryNode[];
	totalFiles: number;
	totalDirectories: number;
	scanTime: number;
	method: "broot" | "native";
	gitAware: boolean;
	resolvedRoot: string;
}

export interface ParsedTreeRow {
	depth: number;
	name: string;
	indentation: string;
}