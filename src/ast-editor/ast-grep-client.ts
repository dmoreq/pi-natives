/**
 * AST-grep client for subprocess management and result parsing
 */

import { spawn, spawnSync } from "node:child_process";
import { checkBinary } from "../shared/cli";
import { AstEditError } from "../shared/errors";
import type { 
	AstGrepSpawnOpts, 
	AstGrepSpawnResult,
	AstChange 
} from "./types";

/**
 * Spawn ast-grep for rewriting operations
 */
export async function spawnAstGrepRewrite(opts: AstGrepSpawnOpts): Promise<AstGrepSpawnResult> {
	const { pattern, replacement, filePath, language, cwd } = opts;
	
	if (!checkBinary("ast-grep")) {
		throw new AstEditError("ast-grep binary not found in PATH");
	}
	
	const args = ["--rewrite", pattern, "--rewrite-to", replacement];
	
	if (language) {
		args.push("--lang", language);
	}
	
	args.push(filePath);
	
	return new Promise((resolve, reject) => {
		const child = spawn("ast-grep", args, {
			cwd: cwd || process.cwd(),
			timeout: 30000
		});
		
		let stdout = "";
		let stderr = "";
		
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		
		child.on("close", (exitCode) => {
			resolve({ exitCode: exitCode || 0, stdout, stderr });
		});
		
		child.on("error", (error) => {
			reject(new AstEditError(`Failed to spawn ast-grep: ${error.message}`));
		});
	});
}

/**
 * Spawn ast-grep for scanning/preview operations
 */
export async function spawnAstGrepScan(opts: AstGrepSpawnOpts): Promise<AstGrepSpawnResult> {
	const { pattern, filePath, language, cwd } = opts;
	
	if (!checkBinary("ast-grep")) {
		throw new AstEditError("ast-grep binary not found in PATH");
	}
	
	const args = ["--json", pattern];
	
	if (language) {
		args.push("--lang", language);
	}
	
	args.push(filePath);
	
	return new Promise((resolve, reject) => {
		const child = spawn("ast-grep", args, {
			cwd: cwd || process.cwd(),
			timeout: 30000
		});
		
		let stdout = "";
		let stderr = "";
		
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		
		child.on("close", (exitCode) => {
			resolve({ exitCode: exitCode || 0, stdout, stderr });
		});
		
		child.on("error", (error) => {
			reject(new AstEditError(`Failed to spawn ast-grep: ${error.message}`));
		});
	});
}

/**
 * Parse ast-grep JSON output to extract match information
 */
export function parseAstGrepMatches(stdout: string): AstChange[] {
	if (!stdout.trim()) {
		return [];
	}
	
	try {
		const matches = JSON.parse(stdout);
		
		if (!Array.isArray(matches)) {
			return [];
		}
		
		return matches.map((match: any) => ({
			line: match.range?.start?.line || 0,
			column: match.range?.start?.column || 0,
			before: match.text || "",
			after: "" // Will be filled in by replacement logic
		}));
		
	} catch (error) {
		// If JSON parsing fails, return empty array
		return [];
	}
}

/**
 * Treat ast-grep `ERROR:` lines as hard failures (`Warning:` lines are tolerated).
 */
export function assertStderrFatal(stderr: string, phase: string): void {
	if (stderr.includes("ERROR:")) {
		throw new AstEditError(`ast-grep ${phase} failed: ${stderr.trim()}`);
	}
}

/**
 * Non-JSON ast-grep phases (diff preview): treat only `ERROR:` stderr plus exit `{0,1}` as benign.
 */
export function assertDiffuseAstGrepExit(out: AstGrepSpawnResult, phase: string): void {
	assertStderrFatal(out.stderr, phase);
	
	if (out.exitCode !== 0 && out.exitCode !== 1) {
		throw new AstEditError(
			`ast-grep ${phase} exited with code ${out.exitCode}: ${out.stderr.trim()}`
		);
	}
}

/**
 * Parse compact match scan results for rewrite operations
 */
export interface RewriteParse {
	/** ast-grep found N matches to rewrite. */
	expectedMatches: number;
	/** Parsing succeeded (valid JSON + exit codes). */
	success: boolean;
}

/**
 * Parse ast-grep compact match output
 */
export function parseCompactMatchScan(out: AstGrepSpawnResult): RewriteParse {
	// Handle undefined exit code
	const exitCode = out.exitCode ?? -1;
	
	// Exit code 1 with empty stdout = no matches found
	if (exitCode === 1 && !out.stdout.trim()) {
		return { expectedMatches: 0, success: true };
	}
	
	// Exit codes outside {0,1} are errors
	if (exitCode !== 0 && exitCode !== 1) {
		throw new AstEditError(
			`ast-grep scan failed with code ${exitCode}: ${out.stderr.trim()}`
		);
	}
	
	// Check for ERROR lines in stderr
	assertStderrFatal(out.stderr, "scan");
	
	if (exitCode === 0) {
		try {
			const matches = JSON.parse(out.stdout);
			const count = Array.isArray(matches) ? matches.length : 0;
			return { expectedMatches: count, success: true };
		} catch {
			throw new AstEditError("ast-grep returned malformed JSON output");
		}
	}
	
	return { expectedMatches: 0, success: true };
}