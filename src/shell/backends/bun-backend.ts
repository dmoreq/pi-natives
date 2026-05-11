/**
 * Bun shell backend using Bun.$ tagged templates
 */

import { BaseShellBackend } from "./base-backend";
import type { ShellBackendRunResult, ShellBackendOpts } from "../types";

/**
 * Bun shell backend using Bun.$ for command execution
 */
export class BunBackend extends BaseShellBackend {
	getName(): string {
		return "bun";
	}
	
	isAvailable(): boolean {
		// Check if we're running in Bun environment
		return typeof Bun !== "undefined" && typeof Bun.$ !== "undefined";
	}
	
	async execute(command: string, options: ShellBackendOpts = {}): Promise<ShellBackendRunResult> {
		if (!this.isAvailable()) {
			throw new Error("Bun shell backend not available");
		}
		
		const startTime = Date.now();
		
		try {
			// Parse command and args for Bun.$
			const parts = command.split(/\s+/);
			const cmd = parts[0];
			const args = parts.slice(1);
			
			// Use Bun's $ shell with proper syntax
			let shellCommand;
			if (args.length > 0) {
				shellCommand = Bun.$`${cmd} ${args}`;
			} else {
				shellCommand = Bun.$`${cmd}`;
			}
			
			if (options.cwd) {
				shellCommand = shellCommand.cwd(options.cwd);
			}
			
			if (options.env) {
				shellCommand = shellCommand.env(this.mergeEnv(options.env));
			}
			
			const result = await shellCommand;
			
			const executionMs = Date.now() - startTime;
			
			return this.createResult(
				result.exitCode || 0,
				result.text() || "",
				result.stderr?.text() || "",
				0, // Startup time not easily measurable
				executionMs
			);
			
		} catch (error) {
			const executionMs = Date.now() - startTime;
			
			// Handle Bun shell errors - Bun.$ throws on non-zero exit codes
			if (error && typeof error === "object" && "exitCode" in error) {
				const bunError = error as any;
				return this.createResult(
					bunError.exitCode || 1,
					bunError.stdout?.text?.() || bunError.text?.() || "",
					bunError.stderr?.text?.() || "",
					0,
					executionMs
				);
			}
			
			// For successful commands that Bun throws on, try to extract output
			if (error && typeof error === "object" && "text" in error) {
				const bunResult = error as any;
				return this.createResult(
					0, // Assume success if we got output
					bunResult.text?.() || String(bunResult),
					"",
					0,
					executionMs
				);
			}
			
			// Generic error
			return this.createResult(
				1,
				"",
				error instanceof Error ? error.message : String(error),
				0,
				executionMs
			);
		}
	}
}