import { spawnSync } from "node:child_process";

/**
 * Check if a CLI binary is available on $PATH.
 * Eliminates 4 nearly-identical `checkXxxInstalled()` functions.
 */
export function checkBinary(binaryName: string): string | null {
	const result = spawnSync("which", [binaryName], { encoding: "utf-8" });
	return result.status === 0 ? result.stdout.trim() : null;
}

/**
 * Check availability for a list of binaries, returning a Map of name → path (or null).
 */
export function checkBinaries(
	binaryNames: string[],
): Map<string, string | null> {
	const results = new Map<string, string | null>();
	for (const name of binaryNames) {
		results.set(name, checkBinary(name));
	}
	return results;
}
