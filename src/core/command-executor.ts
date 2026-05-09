/**
 * Unified command execution framework for pi-sherlock
 * 
 * Consolidates subprocess management that was scattered across multiple tools,
 * providing consistent error handling, cancellation, and result formatting.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import type { SpawnOptions } from "bun";

/**
 * Command execution result
 */
export interface CommandResult {
	/** Command that was executed */
	command: string;
	
	/** Command arguments */
	args: string[];
	
	/** Exit code */
	exitCode: number;
	
	/** Standard output */
	stdout: string;
	
	/** Standard error */
	stderr: string;
	
	/** Execution time in milliseconds */
	duration: number;
	
	/** Whether command was cancelled */
	cancelled: boolean;
	
	/** Working directory */
	cwd?: string;
	
	/** Environment variables used */
	env?: Record<string, string>;
}

/**
 * Command execution options
 */
export interface CommandOptions {
	/** Working directory */
	cwd?: string;
	
	/** Environment variables */
	env?: Record<string, string>;
	
	/** Timeout in milliseconds */
	timeout?: number;
	
	/** Abort signal for cancellation */
	signal?: AbortSignal;
	
	/** Input to pipe to stdin */
	input?: string;
	
	/** Maximum stdout buffer size */
	maxStdoutSize?: number;
	
	/** Maximum stderr buffer size */
	maxStderrSize?: number;
	
	/** Whether to include stdout in result on non-zero exit */
	includeStdoutOnError?: boolean;
	
	/** Whether to throw on non-zero exit codes */
	throwOnError?: boolean;
}

/**
 * Command execution error
 */
export class CommandExecutionError extends Error {
	constructor(
		message: string,
		public result: CommandResult,
		public cause?: Error
	) {
		super(message);
		this.name = 'CommandExecutionError';
	}
}

/**
 * Command timeout error
 */
export class CommandTimeoutError extends CommandExecutionError {
	constructor(result: CommandResult, timeout: number) {
		super(`Command timed out after ${timeout}ms`, result);
		this.name = 'CommandTimeoutError';
	}
}

/**
 * Command cancellation error
 */
export class CommandCancelledError extends CommandExecutionError {
	constructor(result: CommandResult) {
		super('Command was cancelled', result);
		this.name = 'CommandCancelledError';
	}
}

/**
 * Default command execution options
 */
const DEFAULT_OPTIONS: Required<Omit<CommandOptions, 'cwd' | 'env' | 'input' | 'signal'>> = {
	timeout: 30000, // 30 seconds
	maxStdoutSize: 10 * 1024 * 1024, // 10MB
	maxStderrSize: 1024 * 1024, // 1MB
	includeStdoutOnError: true,
	throwOnError: true
};

/**
 * Unified command executor
 */
export class CommandExecutor {
	/**
	 * Execute a command with full control over options
	 */
	static async execute(
		command: string,
		args: string[] = [],
		options: CommandOptions = {}
	): Promise<CommandResult> {
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const startTime = Date.now();
		
		// Create combined abort signal
		const controller = new AbortController();
		const combinedSignal = this.combineSignals([
			controller.signal,
			...(opts.signal ? [opts.signal] : [])
		]);
		
		// Set up timeout
		const timeoutHandle = opts.timeout > 0 
			? setTimeout(() => controller.abort(), opts.timeout)
			: null;
		
		try {
			const result = await this.spawnProcess(command, args, opts, combinedSignal);
			
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			
			const duration = Date.now() - startTime;
			const finalResult = { ...result, duration };
			
			// Handle cancellation and timeout
			if (result.cancelled || combinedSignal.aborted) {
				if (opts.signal?.aborted) {
					throw new CommandCancelledError(finalResult);
				} else {
					throw new CommandTimeoutError(finalResult, opts.timeout!);
				}
			}
			
			if (opts.throwOnError && result.exitCode !== 0) {
				throw new CommandExecutionError(
					`Command failed with exit code ${result.exitCode}`,
					finalResult
				);
			}
			
			return finalResult;
			
		} catch (error) {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			
			if (error instanceof CommandExecutionError) {
				throw error;
			}
			
			// Wrap unexpected errors
			const duration = Date.now() - startTime;
			const errorResult: CommandResult = {
				command,
				args,
				exitCode: -1,
				stdout: '',
				stderr: error instanceof Error ? error.message : String(error),
				duration,
				cancelled: false,
				cwd: opts.cwd,
				env: opts.env
			};
			
			throw new CommandExecutionError(
				`Command execution failed: ${error instanceof Error ? error.message : error}`,
				errorResult,
				error instanceof Error ? error : undefined
			);
		}
	}
	
	/**
	 * Execute a command and return only stdout on success
	 */
	static async executeForOutput(
		command: string,
		args: string[] = [],
		options: CommandOptions = {}
	): Promise<string> {
		const result = await this.execute(command, args, options);
		return result.stdout;
	}
	
	/**
	 * Execute a command without throwing on non-zero exit
	 */
	static async executeSafe(
		command: string,
		args: string[] = [],
		options: CommandOptions = {}
	): Promise<CommandResult> {
		return this.execute(command, args, { ...options, throwOnError: false });
	}
	
	/**
	 * Check if a command/binary exists
	 */
	static async exists(command: string): Promise<boolean> {
		try {
			const result = await this.executeSafe('which', [command], {
				timeout: 5000,
				throwOnError: false
			});
			return result.exitCode === 0 && result.stdout.trim().length > 0;
		} catch {
			return false;
		}
	}
	
	/**
	 * Execute multiple commands in parallel
	 */
	static async executeParallel(
		commands: Array<{ command: string; args?: string[]; options?: CommandOptions }>,
		globalOptions: CommandOptions = {}
	): Promise<CommandResult[]> {
		const promises = commands.map(({ command, args = [], options = {} }) =>
			this.execute(command, args, { ...globalOptions, ...options })
		);
		
		return Promise.all(promises);
	}
	
	/**
	 * Execute commands in sequence
	 */
	static async executeSequence(
		commands: Array<{ command: string; args?: string[]; options?: CommandOptions }>,
		globalOptions: CommandOptions = {}
	): Promise<CommandResult[]> {
		const results: CommandResult[] = [];
		
		for (const { command, args = [], options = {} } of commands) {
			const result = await this.execute(command, args, { ...globalOptions, ...options });
			results.push(result);
		}
		
		return results;
	}
	
	/**
	 * Execute with Bun's spawn for better performance when available
	 */
	static async executeBun(
		command: string,
		args: string[] = [],
		options: CommandOptions = {}
	): Promise<CommandResult> {
		if (typeof Bun === 'undefined') {
			// Fallback to regular execute
			return this.execute(command, args, options);
		}
		
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const startTime = Date.now();
		
		try {
			const spawnOptions: SpawnOptions = {
				cwd: opts.cwd,
				env: opts.env,
				stdin: opts.input ? 'pipe' : undefined,
				stdout: 'pipe',
				stderr: 'pipe'
			};
			
			const proc = Bun.spawn([command, ...args], spawnOptions);
			
			if (opts.input) {
				proc.stdin?.write(opts.input);
				proc.stdin?.end();
			}
			
			const [stdout, stderr] = await Promise.all([
				new Response(proc.stdout).text(),
				new Response(proc.stderr).text()
			]);
			
			const exitCode = await proc.exited;
			const duration = Date.now() - startTime;
			
			const result: CommandResult = {
				command,
				args,
				exitCode,
				stdout,
				stderr,
				duration,
				cancelled: false,
				cwd: opts.cwd,
				env: opts.env
			};
			
			if (opts.throwOnError && exitCode !== 0) {
				throw new CommandExecutionError(
					`Command failed with exit code ${exitCode}`,
					result
				);
			}
			
			return result;
			
		} catch (error) {
			const duration = Date.now() - startTime;
			const errorResult: CommandResult = {
				command,
				args,
				exitCode: -1,
				stdout: '',
				stderr: error instanceof Error ? error.message : String(error),
				duration,
				cancelled: false,
				cwd: opts.cwd,
				env: opts.env
			};
			
			if (error instanceof CommandExecutionError) {
				throw error;
			}
			
			throw new CommandExecutionError(
				`Bun command execution failed: ${error instanceof Error ? error.message : error}`,
				errorResult,
				error instanceof Error ? error : undefined
			);
		}
	}
	
	/**
	 * Spawn and manage process lifecycle
	 */
	private static async spawnProcess(
		command: string,
		args: string[],
		options: CommandOptions & typeof DEFAULT_OPTIONS,
		signal: AbortSignal
	): Promise<Omit<CommandResult, 'duration'>> {
		const spawnOptions = {
			cwd: options.cwd,
			env: { ...process.env, ...options.env }
		};
		
		const child = spawn(command, args, spawnOptions);
		let killed = false;
		
		// Handle abort signal
		const handleAbort = () => {
			if (!killed && !child.killed) {
				killed = true;
				child.kill('SIGTERM');
				// Give process a moment to exit gracefully
				setTimeout(() => {
					if (!child.killed) {
						child.kill('SIGKILL');
					}
				}, 1000);
			}
		};
		
		if (signal.aborted) {
			handleAbort();
		} else {
			signal.addEventListener('abort', handleAbort);
		}
		
		let stdout = '';
		let stderr = '';
		let stdoutTruncated = false;
		let stderrTruncated = false;
		
		// Handle stdout
		child.stdout?.on('data', (chunk: Buffer) => {
			if (stdout.length < options.maxStdoutSize) {
				const remaining = options.maxStdoutSize - stdout.length;
				const chunkStr = chunk.toString();
				if (chunkStr.length <= remaining) {
					stdout += chunkStr;
				} else {
					stdout += chunkStr.substring(0, remaining);
					stdoutTruncated = true;
				}
			}
		});
		
		// Handle stderr
		child.stderr?.on('data', (chunk: Buffer) => {
			if (stderr.length < options.maxStderrSize) {
				const remaining = options.maxStderrSize - stderr.length;
				const chunkStr = chunk.toString();
				if (chunkStr.length <= remaining) {
					stderr += chunkStr;
				} else {
					stderr += chunkStr.substring(0, remaining);
					stderrTruncated = true;
				}
			}
		});
		
		// Handle input
		if (options.input && child.stdin) {
			child.stdin.write(options.input);
			child.stdin.end();
		}
		
		// Wait for process to complete
		const exitCode = await new Promise<number>((resolve, reject) => {
			child.on('close', (code) => {
				resolve(killed ? -1 : (code ?? 0));
			});
			child.on('error', (error) => {
				if (killed) {
					resolve(-1);
				} else {
					reject(error);
				}
			});
		});
		
		// Add truncation warnings
		if (stdoutTruncated) {
			stdout += '\n[... stdout truncated ...]';
		}
		if (stderrTruncated) {
			stderr += '\n[... stderr truncated ...]';
		}
		
		return {
			command,
			args,
			exitCode,
			stdout,
			stderr,
			cancelled: killed || signal.aborted,
			cwd: options.cwd,
			env: options.env
		};
	}
	
	/**
	 * Combine multiple abort signals
	 */
	private static combineSignals(signals: AbortSignal[]): AbortSignal {
		const validSignals = signals.filter(Boolean);
		if (validSignals.length === 0) {
			return new AbortController().signal;
		}
		if (validSignals.length === 1) {
			return validSignals[0];
		}
		
		const controller = new AbortController();
		
		for (const signal of validSignals) {
			if (signal.aborted) {
				controller.abort();
				break;
			}
			signal.addEventListener('abort', () => controller.abort(), { once: true });
		}
		
		return controller.signal;
	}
}