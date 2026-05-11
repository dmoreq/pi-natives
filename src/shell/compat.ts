/**
 * Backward compatibility functions for the nushell-json module
 */

import type { ShellBackendRunResult, ShellBackendOpts } from "./types";
import { BashBackend } from "./backends/bash-backend";

/**
 * Run command via Bun dollar shell - backward compatibility function
 * 
 * Note: For simplicity and reliability, this now uses bash backend
 * instead of trying to replicate Bun.$ behavior exactly.
 */
export async function runBunShellViaBunDollar(
	command: string, 
	opts: ShellBackendOpts
): Promise<ShellBackendRunResult> {
	const bashBackend = new BashBackend();
	return bashBackend.execute(command, opts);
}