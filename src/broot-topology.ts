/**
 * Repository topology mapper — hierarchical directory trees + metadata for agents.
 *
 * When `br`/`broot` exists, `:print_tree` ASCII is parsed into the same nested shape
 * as the native walker. Structured JSON is emitted by tooling (`ls-enhanced`).
 * 
 * This module now serves as a backward-compatible facade over the decomposed broot module.
 */

// Re-export everything from the new modular structure for backward compatibility
export * from "./broot";

// For backward compatibility, also provide the main class as default
import { BrootTopologyMapper } from "./broot";
export default BrootTopologyMapper;