/**
 * Abstract base class for shell backends
 */

import type { ShellBackendRunResult, ShellBackendOpts } from "../types";

/**
 * Base interface for shell backends
 */
export interface ShellBackend {
	/**
	 * Execute a command using this backend
	 */
	execute(command: string, options: ShellBackendOpts): Promise<ShellBackendRunResult>;
	
	/**
	 * Check if this backend is available
	 */
	isAvailable(): boolean;
	
	/**
	 * Get the name of this backend
	 */
	getName(): string;
}

/**
 * Abstract base class for shell backends
 */
export abstract class BaseShellBackend implements ShellBackend {
	abstract execute(command: string, options: ShellBackendOpts): Promise<ShellBackendRunResult>;
	abstract isAvailable(): boolean;
	abstract getName(): string;
	
	/**
	 * Merge environment variables
	 */
	protected mergeEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
		return { ...process.env, ...extra };
	}
	
	/**
	 * Create a standardized result object
	 */
	protected createResult(
		code: number,
		stdout: string,
		stderr: string,
		startupMs: number,
		executionMs: number
	): ShellBackendRunResult {
		return {
			code,
			stdout,
			stderr,
			startupMs,
			executionMs
		};
	}
}