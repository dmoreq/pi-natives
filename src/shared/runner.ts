/**
 * CLI Runner interface — abstraction over `node:child_process.spawn`
 * to enable dependency injection for testing.
 */
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

// ── Interface ───────────────────────────────────────────────────────

export interface CliSpawnResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

export interface CliSpawnOptions {
	/** Command arguments. */
	args: string[];
	/** Working directory. */
	cwd?: string;
	/** Timeout in ms. */
	timeoutMs?: number;
	/** Extra env vars to merge. */
	env?: Record<string, string>;
}

export interface CliRunner {
	/**
	 * Run a command and return stdout, stderr, and exit code.
	 * Must reject if the process fails to spawn or times out.
	 */
	run(command: string, options: CliSpawnOptions): Promise<CliSpawnResult>;
}

// ── Default implementation using real Node.js spawn ─────────────────

export class NodeCliRunner implements CliRunner {
	async run(command: string, options: CliSpawnOptions): Promise<CliSpawnResult> {
		const { args, cwd, timeoutMs, env } = options;

		const spawnOpts: SpawnOptions = {
			stdio: ["ignore", "pipe", "pipe"],
			cwd,
		};
		if (env) {
			spawnOpts.env = { ...process.env, ...env };
		}

		const proc = spawn(command, args, spawnOpts);

		return new Promise<CliSpawnResult>((resolve, reject) => {
			let settled = false;
			const stdoutChunks: Buffer[] = [];
			const stderrChunks: Buffer[] = [];

			const timer = timeoutMs
				? setTimeout(() => {
						if (!settled) {
							settled = true;
							proc.kill();
							reject(new Error(`Command "${command}" timed out after ${timeoutMs}ms`));
						}
				  }, timeoutMs)
				: null;

			proc.stdout.on("data", (chunk: Buffer) => {
				stdoutChunks.push(chunk);
			});

			proc.stderr.on("data", (chunk: Buffer) => {
				stderrChunks.push(chunk);
			});

			proc.on("error", (err: Error) => {
				if (settled) return;
				settled = true;
				if (timer) clearTimeout(timer);
				reject(err);
			});

			proc.on("close", (exitCode: number | null) => {
				if (settled) return;
				settled = true;
				if (timer) clearTimeout(timer);

				resolve({
					stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
					stderr: Buffer.concat(stderrChunks).toString("utf-8"),
					exitCode,
				});
			});
		});
	}
}

/** The default CLI runner used by all tools. */
export const defaultCliRunner: CliRunner = new NodeCliRunner();
