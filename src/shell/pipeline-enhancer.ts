/**
 * Command pipeline enhancement for structured JSON output
 * 
 * Converts POSIX commands to Nushell equivalents with JSON output.
 */

/**
 * True when the trimmed command commonly benefits from a JSON-ending nu pipeline.
 */
export function isStructurableCommand(command: string): boolean {
	const trimmed = command.trim();
	
	// Common commands that benefit from structured output
	const patterns = [
		/^ls\b/,
		/^env\b/,
		/^pwd\b/,
		/^ps\b/,
		/^git\s+(log|status)\b/
	];
	
	return patterns.some(pattern => pattern.test(trimmed));
}

/**
 * Map a user POSIX-style command fragment into Nushell that ends with structured JSON emit.
 */
export function enforceJsonPipeline(command: string): { nuScript: string; enhanced: boolean } {
	const trimmed = command.trim();
	
	// Handle ls commands
	if (trimmed.startsWith("ls")) {
		const args = trimmed.slice(2).trim();
		return {
			nuScript: `ls ${args} | to json`,
			enhanced: true
		};
	}
	
	// Handle env command
	if (trimmed === "env" || trimmed === "env | sort") {
		return {
			nuScript: "$env | to json",
			enhanced: true
		};
	}
	
	// Handle pwd command
	if (trimmed === "pwd") {
		return {
			nuScript: "pwd | to json",
			enhanced: true
		};
	}
	
	// Handle ps command
	if (trimmed.startsWith("ps")) {
		const args = trimmed.slice(2).trim();
		return {
			nuScript: `ps ${args} | select pid name cpu mem | to json`,
			enhanced: true
		};
	}
	
	// Handle git log commands
	if (trimmed.match(/^git\s+log\b/)) {
		// Preserve existing args but ensure JSON format
		if (trimmed.includes("--format=") || trimmed.includes("--pretty=")) {
			// Already has format, just ensure JSON output
			return {
				nuScript: `${trimmed} | from json | to json`,
				enhanced: true
			};
		} else {
			// Add JSON format
			return {
				nuScript: `${trimmed} --format=json | from json | to json`,
				enhanced: true
			};
		}
	}
	
	// Handle git status commands
	if (trimmed.match(/^git\s+status\b/)) {
		// Add porcelain format for structured output
		if (!trimmed.includes("--porcelain")) {
			return {
				nuScript: `${trimmed} --porcelain=v1 | lines | parse "{status_xy} {path}" | to json`,
				enhanced: true
			};
		} else {
			return {
				nuScript: `${trimmed} | lines | parse "{status_xy} {path}" | to json`,
				enhanced: true
			};
		}
	}
	
	// For unrecognized commands, just add JSON pipeline if it looks safe
	if (isStructurableCommand(trimmed)) {
		return {
			nuScript: `${trimmed} | to json`,
			enhanced: true
		};
	}
	
	// No enhancement applied
	return {
		nuScript: trimmed,
		enhanced: false
	};
}

/**
 * Sanitize a table cell key for JSON compatibility
 */
export function sanitizeKey(cell: string): string {
	return cell.replace(/[^\w\s]/g, "_").replace(/\s/g, "_").toLowerCase();
}

/**
 * Split a pipe-delimited line into cells
 */
export function splitPipeCells(line: string): string[] {
	return line.split("|").map(cell => cell.trim());
}