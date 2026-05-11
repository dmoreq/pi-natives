/**
 * Main orchestrator for Nushell JSON command execution
 * 
 * Manages the fallback chain: Nushell -> Bun -> Bash
 */

import { checkBinary } from "../shared/cli";
import type { 
	NushellJsonOptions, 
	NushellJsonResult, 
	ShellDeps, 
	NushellJsonExecutorCtorOptions,
	ShellBackendRunResult,
	ShellBackendOpts
} from "./types";

import { enforceJsonPipeline } from "./pipeline-enhancer";
import { tryInterpretStructured } from "./output-parser";
import { NushellBackend } from "./backends/nushell-backend";
import { BunBackend } from "./backends/bun-backend";
import { BashBackend } from "./backends/bash-backend";

/**
 * Create default shell dependencies
 */
export function createDefaultShellDeps(): ShellDeps {
	const nushellBackend = new NushellBackend();
	const bunBackend = new BunBackend();
	const bashBackend = new BashBackend();
	
	return {
		nuPath: checkBinary("nu") ? "nu" : undefined,
		fallbackToBun: true,
		bunShellEnabled: bunBackend.isAvailable(),
		
		runNu: async (nuScript: string, opts: ShellBackendOpts) => {
			return nushellBackend.execute(nuScript, opts);
		},
		
		runBash: async (cmd: string, opts: ShellBackendOpts) => {
			return bashBackend.execute(cmd, opts);
		},
		
		runBunShell: async (cmd: string, opts: ShellBackendOpts) => {
			return bunBackend.execute(cmd, opts);
		}
	};
}

/**
 * Build a NushellJsonResult from a backend run result
 */
function buildShellResultFromRun(
	shell: NushellJsonResult["shell"], 
	rawOut: ShellBackendRunResult,
	originalCommand: string
): NushellJsonResult {
	const interpretation = tryInterpretStructured(rawOut.stdout);
	
	return {
		output: interpretation.output,
		rawOutput: rawOut.stdout,
		exitCode: rawOut.code,
		executionTime: rawOut.executionMs,
		shell,
		structured: interpretation.structured,
		performance: {
			startupTime: rawOut.startupMs,
			executionTime: rawOut.executionMs
		}
	};
}

/**
 * Nushell JSON executor with fallback chain
 */
export class NushellJsonExecutor {
	private deps: ShellDeps;
	
	constructor(options: NushellJsonExecutorCtorOptions = {}) {
		const defaultDeps = createDefaultShellDeps();
		this.deps = { ...defaultDeps, ...options.deps };
	}
	
	/**
	 * Execute a command with Nushell JSON pipeline and fallback chain
	 */
	async execute(options: NushellJsonOptions): Promise<NushellJsonResult> {
		const { command, enforceJson = true, timeout = 120_000, cwd, env, fallbackToBun = true, signal } = options;
		
		const backendOpts: ShellBackendOpts = {
			cwd,
			env,
			timeoutMs: timeout,
			signal
		};
		
		// Try Nushell first if available
		if (this.deps.nuPath && this.deps.runNu) {
			try {
				const enhanced = enforceJson ? enforceJsonPipeline(command) : { nuScript: command, enhanced: false };
				const result = await this.deps.runNu(enhanced.nuScript, backendOpts);
				
				// If nushell succeeded, return its result
				if (result.code === 0) {
					return buildShellResultFromRun("nushell", result, command);
				}
				
				// If nushell failed but we don't want fallback, return the nushell result
				if (!fallbackToBun) {
					return buildShellResultFromRun("nushell", result, command);
				}
			} catch (error) {
				// Nushell execution failed, continue to fallback
				if (!fallbackToBun) {
					throw error;
				}
			}
		}
		
		// Try Bun shell if available and enabled
		if (this.deps.bunShellEnabled && this.deps.runBunShell && fallbackToBun) {
			try {
				const result = await this.deps.runBunShell(command, backendOpts);
				
				if (result.code === 0) {
					return buildShellResultFromRun("bun", result, command);
				}
				
				// If bun failed, continue to bash fallback
			} catch (error) {
				// Bun execution failed, continue to bash fallback
			}
		}
		
		// Final fallback: Bash
		if (this.deps.runBash) {
			try {
				const result = await this.deps.runBash(command, backendOpts);
				return buildShellResultFromRun("bash", result, command);
			} catch (error) {
				throw new Error(`All shell backends failed. Last error: ${error instanceof Error ? error.message : error}`);
			}
		}
		
		throw new Error("No shell backends available");
	}
	
	/**
	 * Check which shell backends are available
	 */
	getAvailableBackends(): string[] {
		const backends: string[] = [];
		
		if (this.deps.nuPath) {
			backends.push("nushell");
		}
		
		if (this.deps.bunShellEnabled) {
			backends.push("bun");
		}
		
		backends.push("bash"); // Always available
		
		return backends;
	}
}