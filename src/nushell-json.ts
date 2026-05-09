/**
 * Structured shell execution with Nushell `| to json` pipelines and POSIX fallbacks.
 *
 * POSIX "Bun" tier uses **`Bun.$`** tagged templates (`import { $ } from "bun"` is identical at runtime).
 * 
 * This module now serves as a backward-compatible facade over the decomposed shell module.
 */

// Re-export everything from the new modular structure for backward compatibility
export * from "./shell";

// For backward compatibility, also provide the main class as default
import { NushellJsonExecutor } from "./shell";
export default NushellJsonExecutor;