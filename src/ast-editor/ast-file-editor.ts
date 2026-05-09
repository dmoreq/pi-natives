/**
 * Main orchestrator for AST-aware file editing
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { existsSync } from "node:fs";

import { BunFileWriter } from "../bun-writer";
import { AstEditError } from "../shared/errors";
import { checkBinary } from "../shared/cli";
import { FileTypeRegistry, FileType, CodeLanguage } from "../core/file-type-registry";
import { astGrepLanguageForFile } from "../read-router";

import type { 
	AstEditOptions, 
	AstEditResult, 
	AstFileEditorOptions,
	AstGrepSpawnOpts
} from "./types";

import { 
	buildRewritePattern, 
	scopeReservationWarnings, 
	attachWarnings 
} from "./pattern-builder";

import { 
	spawnAstGrepRewrite, 
	spawnAstGrepScan,
	parseCompactMatchScan,
	assertDiffuseAstGrepExit
} from "./ast-grep-client";

import { validateTsJsSyntax, quickSyntaxCheck } from "./syntax-validator";
import { createBackup, restoreFromBackup } from "./backup-manager";
import { 
	countLiteralOccurrences, 
	replaceAllLiteral, 
	performNativeEdit 
} from "./native-fallback";

/**
 * AST-aware file editor with native fallback
 */
export class AstFileEditor {
	constructor(private options: AstFileEditorOptions = {}) {}

	/**
	 * Edit a file using AST-aware patterns with native fallback
	 */
	async edit(editOpts: AstEditOptions): Promise<AstEditResult> {
		// Validate inputs
		if (!editOpts.path?.trim()) {
			throw new AstEditError("File path cannot be empty");
		}

		const pattern = buildRewritePattern(editOpts.pattern, editOpts.nodeType);
		const resolvedPath = path.resolve(editOpts.cwd || this.options.cwd || process.cwd(), editOpts.path);

		// Check if file exists
		if (!existsSync(resolvedPath)) {
			throw new AstEditError(`File not found: ${resolvedPath}`);
		}

		// Read file content
		const originalContent = await fs.readFile(resolvedPath, "utf8");
		
		// Detect file type
		const classification = FileTypeRegistry.classify(editOpts.path);
		
		// Check for scope warnings
		const scopeWarnings = scopeReservationWarnings(editOpts.scope);

		// Determine whether to use AST-grep or native fallback
		const useAstGrep = this.shouldUseAstGrep(classification, pattern);
		
		let result: AstEditResult;
		
		if (useAstGrep) {
			result = await this.performAstGrepEdit(
				resolvedPath,
				pattern,
				editOpts.replacement,
				classification,
				editOpts.preview || false,
				editOpts.cwd
			);
		} else {
			result = performNativeEdit(
				originalContent,
				pattern,
				editOpts.replacement,
				editOpts.path,
				editOpts.preview || false
			);
		}

		// Apply scope warnings
		result = attachWarnings(result, scopeWarnings);

		// Handle backup creation (only for actual writes)
		if (!editOpts.preview && result.matchCount > 0) {
			const shouldBackup = editOpts.backup !== false; // Default to true
			
			if (shouldBackup) {
				try {
					result.backupPath = await createBackup(resolvedPath, editOpts.cwd);
				} catch (error) {
					result.warnings.push(`Backup creation failed: ${error instanceof Error ? error.message : error}`);
				}
			}

			// Apply the changes for real writes
			if (useAstGrep) {
				// ast-grep already modified the file, just validate syntax if needed
				const newContent = await fs.readFile(resolvedPath, "utf8");
				const syntaxWarnings = quickSyntaxCheck(newContent, resolvedPath);
				result.warnings.push(...syntaxWarnings);
				
				// For critical files, do full Bun validation
				if (classification.type === FileType.CODE && classification.language === CodeLanguage.TYPESCRIPT) {
					try {
						await validateTsJsSyntax(newContent, resolvedPath, editOpts.cwd);
					} catch (error) {
						// If validation fails, restore from backup if available
						if (result.backupPath) {
							try {
								await restoreFromBackup(result.backupPath, resolvedPath);
								result.warnings.push("Changes reverted due to syntax validation failure");
							} catch {
								// Restoration failed
							}
						}
						throw error;
					}
				}
			} else {
				// Apply native changes using BunFileWriter
				const modifiedContent = replaceAllLiteral(originalContent, pattern, editOpts.replacement);
				
				const writer = new BunFileWriter();
				try {
					await writer.write({
						path: resolvedPath,
						content: modifiedContent,
						atomic: true
					});
				} catch (error) {
					// If write fails and we have backup, try to restore
					if (result.backupPath) {
						try {
							await restoreFromBackup(result.backupPath, resolvedPath);
						} catch {
							// Restoration failed
						}
					}
					throw error;
				}
			}
		}

		return result;
	}

	/**
	 * Restore a file from its backup
	 */
	async restore(filePath: string, backupPath?: string, cwd?: string): Promise<void> {
		if (backupPath) {
			const resolvedPath = path.resolve(cwd || this.options.cwd || process.cwd(), filePath);
			await restoreFromBackup(backupPath, resolvedPath);
		} else {
			throw new AstEditError("No backup path provided for restoration");
		}
	}
	
	/**
	 * Static restore method for backward compatibility
	 */
	static async restore(backupPath: string, targetPath: string): Promise<void> {
		await restoreFromBackup(backupPath, targetPath);
	}

	/**
	 * Determine whether to use ast-grep or native fallback
	 */
	private shouldUseAstGrep(classification: any, pattern: string): boolean {
		// Only use ast-grep for code files
		if (classification.type !== FileType.CODE) {
			return false;
		}

		// Check if ast-grep binary is available
		if (!checkBinary("ast-grep")) {
			return false;
		}

		// Check if the language is supported by ast-grep
		const astGrepLang = astGrepLanguageForFile("dummy", classification.language);
		if (!astGrepLang) {
			return false;
		}

		// For simple literal replacements, native might be faster
		// (This is a heuristic - could be made configurable)
		if (pattern.length < 50 && !pattern.includes("$") && !pattern.includes("(")) {
			return false;
		}

		return true;
	}

	/**
	 * Perform AST-grep based editing
	 */
	private async performAstGrepEdit(
		filePath: string,
		pattern: string,
		replacement: string,
		classification: any,
		preview: boolean,
		cwd?: string
	): Promise<AstEditResult> {
		const astGrepLang = astGrepLanguageForFile("dummy", classification.language);
		
		if (!astGrepLang) {
			throw new AstEditError(`Unsupported language for ast-grep: ${classification.language}`);
		}

		const spawnOpts: AstGrepSpawnOpts = {
			pattern,
			replacement,
			filePath,
			language: astGrepLang,
			cwd: cwd || this.options.cwd
		};

		try {
			if (preview) {
				// For preview, do a scan to count matches
				const scanResult = await spawnAstGrepScan(spawnOpts);
				const parseResult = parseCompactMatchScan(scanResult);
				
				if (parseResult.expectedMatches === 0) {
				return {
					summary: `No AST matches found for pattern in ${path.basename(filePath)}`,
					matchCount: 0,
					totalChanges: 0,
					method: "ast-grep",
					warnings: [],
					syntaxValid: true
				};
				}
				
				const previewMsg = `Preview not available for ast-grep (found ${parseResult.expectedMatches} matches)`;
				return {
					summary: `Found ${parseResult.expectedMatches} AST match${parseResult.expectedMatches === 1 ? "" : "es"} in ${path.basename(filePath)}`,
					matchCount: parseResult.expectedMatches,
					totalChanges: parseResult.expectedMatches,
					method: "ast-grep",
					warnings: [],
					preview: previewMsg,
					previewDiff: previewMsg,
					syntaxValid: true
				};
				
			} else {
				// For actual edit, use rewrite
				const rewriteResult = await spawnAstGrepRewrite(spawnOpts);
				assertDiffuseAstGrepExit(rewriteResult, "rewrite");
				
				// Count matches by scanning first
				const scanResult = await spawnAstGrepScan(spawnOpts);
				const parseResult = parseCompactMatchScan(scanResult);
				
				return {
					summary: `Applied ${parseResult.expectedMatches} AST rewrite${parseResult.expectedMatches === 1 ? "" : "s"} in ${path.basename(filePath)}`,
					matchCount: parseResult.expectedMatches,
					totalChanges: parseResult.expectedMatches,
					method: "ast-grep",
					warnings: [],
					syntaxValid: true
				};
			}
			
		} catch (error) {
			throw new AstEditError(
				`AST-grep operation failed: ${error instanceof Error ? error.message : error}`
			);
		}
	}
}