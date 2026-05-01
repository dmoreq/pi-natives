/**
 * FileSystem interface — abstraction over `node:fs/promises`
 * to enable dependency injection for testing.
 */
import * as nodeFs from "node:fs/promises";
import type { Stats } from "node:fs";

// ── Interface ───────────────────────────────────────────────────────

export interface FileSystem {
	readFile(path: string): Promise<string>;
	stat(path: string): Promise<Stats>;
	readdir(path: string): Promise<nodeFs.Dirent[]>;
}

// ── Default implementation using real Node.js fs ────────────────────

export class NodeFileSystem implements FileSystem {
	async readFile(path: string): Promise<string> {
		return nodeFs.readFile(path, "utf-8");
	}

	async stat(path: string): Promise<Stats> {
		return nodeFs.stat(path);
	}

	async readdir(path: string): Promise<nodeFs.Dirent[]> {
		return nodeFs.readdir(path, { withFileTypes: true });
	}
}

/** The default filesystem used by all tools. */
export const defaultFileSystem: FileSystem = new NodeFileSystem();
