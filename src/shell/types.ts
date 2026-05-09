/**
 * Type definitions for shell execution system
 */

export interface NushellJsonOptions {
	command: string;
	enforceJson?: boolean;
	timeout?: number;
	cwd?: string;
	env?: Record<string, string>;
	fallbackToBun?: boolean;
	/** Agent / host cancellation forwarded into `Bun.spawn` backends and raced for the Bun.`$` tier. */
	signal?: AbortSignal;
}

/** Matches the enhancement-plan contract exactly (`output` is intentionally `any`). */
export interface NushellJsonResult {
	output: any;
	rawOutput: string;
	exitCode: number;
	executionTime: number;
	shell: "nushell" | "bun" | "bash";
	structured: boolean;
	performance: {
		startupTime: number;
		executionTime: number;
	};
}

export interface ShellBackendRunResult {
	code: number;
	stdout: string;
	stderr: string;
	startupMs: number;
	executionMs: number;
}

/** Options passed down to POSIX / Nu subprocess runners (timeout + cooperative abort). */
export interface ShellBackendOpts {
	cwd?: string;
	env?: Record<string, string>;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export interface ShellDeps {
	nuPath?: string;
	fallbackToBun?: boolean;
	bunShellEnabled?: boolean;
	runNu?: (nuScript: string, opts: ShellBackendOpts) => Promise<ShellBackendRunResult>;
	runBash?: (cmd: string, opts: ShellBackendOpts) => Promise<ShellBackendRunResult>;
	runBunShell?: (cmd: string, opts: ShellBackendOpts) => Promise<ShellBackendRunResult>;
}

export interface NushellJsonExecutorCtorOptions {
	deps?: Partial<ShellDeps>;
}