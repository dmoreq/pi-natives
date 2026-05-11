/**
 * Nushell backend for shell command execution
 */

import { spawn } from "node:child_process";
import { checkBinary } from "../../shared/cli";
import { BaseShellBackend } from "./base-backend";
import type { ShellBackendRunResult, ShellBackendOpts } from "../types";

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Nushell shell backend
 */
export class NushellBackend extends BaseShellBackend {
	constructor(private nuPath?: string) {
		super();
	}
	
	getName(): string {
		return "nushell";
	}
	
	isAvailable(): boolean {
		if (this.nuPath) {
			return checkBinary(this.nuPath);
		}
		return checkBinary("nu");
	}
	
	async execute(nuScript: string, options: ShellBackendOpts = {}): Promise<ShellBackendRunResult> {
		const startTime = Date.now();
		
		const nuBinary = this.nuPath || "nu";
		const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
		
		return new Promise((resolve, reject) => {
			const child = spawn(nuBinary, ["-c", nuScript], {
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