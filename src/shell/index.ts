/**
 * Shell execution module - main exports
 * 
 * Provides structured shell command execution with Nushell JSON pipelines and POSIX fallbacks.
 */

// Main orchestrator
export { NushellJsonExecutor, createDefaultShellDeps } from "./nushell-json-executor";

// Core types
export type {
	NushellJsonOptions,
	NushellJsonResult,
	ShellBackendRunResult,
	ShellBackendOpts,
	ShellDeps,
	NushellJsonExecutorCtorOptions
} from "./types";

// Pipeline enhancement
export {
	isStructurableCommand,
	enforceJsonPipeline,
	sanitizeKey,
	splitPipeCells
} from "./pipeline-enhancer";

// Output parsing
export {
	safeJsonParse,
	extractJson,
	parseNushellTable,
	tryInterpretStructured
} from "./output-parser";

// Shell backends (for advanced usage)
export { BaseShellBackend, type ShellBackend } from "./backends/base-backend";
export { NushellBackend } from "./backends/nushell-backend";
export { BunBackend } from "./backends/bun-backend";
export { BashBackend } from "./backends/bash-backend";

// Backward compatibility functions
export { runBunShellViaBunDollar } from "./compat";