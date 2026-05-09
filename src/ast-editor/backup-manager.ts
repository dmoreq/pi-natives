/**
 * Backup management for AST editor operations
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { AstEditError } from "../shared/errors";

/**
 * Create a backup of a file before editing
 */
export async function createBackup(filePath: string, cwd?: string): Promise<string> {
	const resolvedPath = path.resolve(cwd || process.cwd(), filePath);
	
	// Read original content
	let originalContent: string;
	try {
		originalContent = await fs.readFile(resolvedPath, "utf8");
	} catch (error) {
		throw new AstEditError(`Failed to read file for backup: ${error instanceof Error ? error.message : error}`);
	}
	
	// Generate backup filename
	const dir = path.dirname(resolvedPath);
	const name = path.basename(resolvedPath);
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const random = randomBytes(4).toString("hex");
	const backupName = `.${name}.backup.${timestamp}.${random}`;
	const backupPath = path.join(dir, backupName);
	
	// Write backup
	try {
		await fs.writeFile(backupPath, originalContent, "utf8");
		return backupPath;
	} catch (error) {
		throw new AstEditError(`Failed to create backup: ${error instanceof Error ? error.message : error}`);
	}
}

/**
 * Restore a file from its backup
 */
export async function restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
	try {
		const backupContent = await fs.readFile(backupPath, "utf8");
		await fs.writeFile(targetPath, backupContent, "utf8");
	} catch (error) {
		throw new AstEditError(`Failed to restore from backup: ${error instanceof Error ? error.message : error}`);
	}
}

/**
 * Clean up backup file
 */
export async function cleanupBackup(backupPath: string): Promise<void> {
	try {
		await fs.unlink(backupPath);
	} catch {
		// Ignore cleanup errors - backup might have been manually removed
	}
}

/**
 * List backup files for a given source file
 */
export async function listBackups(filePath: string, cwd?: string): Promise<string[]> {
	const resolvedPath = path.resolve(cwd || process.cwd(), filePath);
	const dir = path.dirname(resolvedPath);
	const name = path.basename(resolvedPath);
	
	try {
		const files = await fs.readdir(dir);
		const backupPattern = `.${name}.backup.`;
		
		return files
			.filter(file => file.startsWith(backupPattern))
			.map(file => path.join(dir, file))
			.sort(); // Sort by filename (which includes timestamp)
			
	} catch {
		return [];
	}
}

/**
 * Get the most recent backup for a file
 */
export async function getMostRecentBackup(filePath: string, cwd?: string): Promise<string | null> {
	const backups = await listBackups(filePath, cwd);
	return backups.length > 0 ? backups[backups.length - 1] : null;
}