/**
 * Syntax validation using Bun's TypeScript checker
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { AstEditError } from "../shared/errors";

/**
 * Validate TypeScript/JavaScript syntax using Bun
 */
export async function validateTsJsSyntax(
	content: string, 
	filePath: string, 
	cwd?: string
): Promise<void> {
	// Only validate TS/JS files
	const ext = path.extname(filePath).toLowerCase();
	if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
		return; // Skip validation for non-TS/JS files
	}
	
	// Create a temporary file for validation
	const tempName = `.syntax-check-${randomBytes(4).toString("hex")}.ts`;
	const tempPath = path.resolve(cwd || process.cwd(), tempName);
	
	try {
		await fs.writeFile(tempPath, content, "utf8");
		
		// Use Bun to check syntax (TypeScript check without emitting)
		const result = spawnSync("bun", ["build", tempPath, "--target", "node", "--no-bundle"], {
			cwd: cwd || process.cwd(),
			encoding: "utf8",
			timeout: 10000
		});
		
		// If Bun exits with error, syntax is invalid
		if (result.status !== 0) {
			const errorOutput = result.stderr || result.stdout || "Unknown syntax error";
			throw new AstEditError(
				`Syntax validation failed for ${path.basename(filePath)}: ${errorOutput.trim()}`
			);
		}
		
	} finally {
		// Clean up temp file
		try {
			await fs.unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Quick syntax validation for common patterns
 */
export function quickSyntaxCheck(content: string, filePath: string): string[] {
	const warnings: string[] = [];
	const ext = path.extname(filePath).toLowerCase();
	
	// Only check TS/JS files
	if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
		return warnings;
	}
	
	// Check for obvious syntax issues
	const lines = content.split("\n");
	
	// Check for unmatched braces (basic check)
	let braceCount = 0;
	let parenCount = 0;
	let bracketCount = 0;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		// Skip strings and comments (basic)
		const cleanLine = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''").replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
		
		for (const char of cleanLine) {
			switch (char) {
				case "{": braceCount++; break;
				case "}": braceCount--; break;
				case "(": parenCount++; break;
				case ")": parenCount--; break;
				case "[": bracketCount++; break;
				case "]": bracketCount--; break;
			}
		}
	}
	
	if (braceCount !== 0) {
		warnings.push(`Unmatched braces detected (${braceCount > 0 ? "missing" : "extra"} closing brace)`);
	}
	
	if (parenCount !== 0) {
		warnings.push(`Unmatched parentheses detected (${parenCount > 0 ? "missing" : "extra"} closing paren)`);
	}
	
	if (bracketCount !== 0) {
		warnings.push(`Unmatched brackets detected (${bracketCount > 0 ? "missing" : "extra"} closing bracket)`);
	}
	
	return warnings;
}