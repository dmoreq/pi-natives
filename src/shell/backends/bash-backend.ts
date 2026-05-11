/**
 * POSIX Bash backend for shell command execution
 */

import { spawn } from "node:child_process";
import { BaseShellBackend } from "./base-backend";
import type { ShellBackendRunResult, ShellBackendOpts } from "../types";

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * POSIX Bash shell backend
 */
export class BashBackend extends BaseShellBackend {
	getName(): string {
		return "bash";
	}
	
	isAvailable(): boolean {
		// Bash should be available on most Unix-like systems
		return true;
	}
	
	async execute(command: string, options: ShellBackendOpts = {}): Promise<ShellBackendRunResult> {
		const startTime = Date.now();
		
		const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
		
		return new Promise((resolve, reject) => {
			const child = spawn("/bin/bash", ["-c", command], {
				cwd: options.cwd || process.cwd(),
				env: this.mergeEnv(options.env),
				timeout: timeoutMs,
				signal: options.signal
			});
			
			let stdout = "";
			let stderr = "";
			
			child.stdout?.on("data", (chunk) => {
				stdout += chunk.toString();
			});
			
			child.stderr?.on("data", (chunk) => {
				stderr += chunk.toString();
			});
			
			child.on("close", (code) => {
				const executionMs = Date.now() - startTime;
				resolve(this.createResult(
					code || 0,
					stdout,
					stderr,
					0, // Startup time not easily measurable for spawn
					executionMs
				));
			});
			
			child.on("error", (error) => {
				const executionMs = Date.now() - startTime;
				// Convert spawn errors to failed execution result
				resolve(this.createResult(
					1,
					"",
					error.message,
					0,
					executionMs
				));
			});
		});
	}
}