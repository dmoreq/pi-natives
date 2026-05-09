/**
 * AST-aware edits via ast-grep `--rewrite`, with literal fallback for non-code files
 * or when ast-grep is unavailable. Applies changes atomically via {@link BunFileWriter}.
 * 
 * This module now serves as a backward-compatible facade over the decomposed ast-editor module.
 */

// Re-export everything from the new modular structure for backward compatibility
export * from "./ast-editor/index";

// For backward compatibility, also provide the main class as default
import { AstFileEditor } from "./ast-editor/index";
export default AstFileEditor;