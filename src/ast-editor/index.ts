/**
 * AST Editor module - main exports
 * 
 * Provides AST-aware file editing with native fallback capabilities.
 */

// Main orchestrator
export { AstFileEditor } from "./ast-file-editor";

// Core types
export type {
	AstEditOptions,
	AstEditResult,
	AstChange,
	AstGrepSpawnOpts,
	AstFileEditorOptions,
	AstGrepSpawnResult
} from "./types";

// Pattern building utilities
export {
	buildRewritePattern,
	strictnessForNodeType,
	scopeReservationWarnings,
	attachWarnings
} from "./pattern-builder";

// AST-grep client
export {
	spawnAstGrepRewrite,
	spawnAstGrepScan,
	parseAstGrepMatches,
	assertStderrFatal,
	assertDiffuseAstGrepExit,
	parseCompactMatchScan
} from "./ast-grep-client";

// Syntax validation
export {
	validateTsJsSyntax,
	quickSyntaxCheck
} from "./syntax-validator";

// Backup management
export {
	createBackup,
	restoreFromBackup,
	cleanupBackup,
	listBackups,
	getMostRecentBackup
} from "./backup-manager";

// Native fallback utilities
export {
	countLiteralOccurrences,
	replaceAllLiteral,
	syntheticNativeChanges,
	formatNativePreview,
	performNativeEdit
} from "./native-fallback";