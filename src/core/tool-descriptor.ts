/**
 * Tool descriptor types for declarative tool registration
 * 
 * This replaces manual tool registration with a registry-based approach
 * that eliminates OCP violations when adding new tools.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Binary requirement specification for tool dependencies
 */
export interface BinaryRequirement {
	/** Binary name to check (e.g., 'rg', 'ast-grep') */
	binary: string;
	
	/** Human-readable label for notifications */
	label: string;
	
	/** Installation command suggestion */
	installCommand: string;
	
	/** Custom check function (optional, defaults to `which` check) */
	customCheck?: () => boolean;
	
	/** Whether this binary is required or optional */
	required: boolean;
}

/**
 * Tool category for organization and filtering
 */
export enum ToolCategory {
	SEARCH = 'search',
	FILE_OPS = 'file-ops', 
	CODE_ANALYSIS = 'code-analysis',
	ENHANCED_CORE = 'enhanced-core',
	UTILITY = 'utility'
}

/**
 * Complete tool descriptor for registry-based registration
 */
export interface ToolDescriptor {
	/** Unique tool identifier */
	id: string;
	
	/** Tool category for organization */
	category: ToolCategory;
	
	/** Function to register the tool with ExtensionAPI */
	registerFn: (api: ExtensionAPI, description: string) => void;
	
	/** Path to prompt file relative to project root */
	promptFile: string;
	
	/** Binary dependencies that generate warnings if missing */
	binaries?: BinaryRequirement[];
	
	/** Tool version for compatibility tracking */
	version?: string;
	
	/** Whether tool is enabled by default */
	enabled?: boolean;
	
	/** Tool dependencies (other tools that must be registered first) */
	dependencies?: string[];
}

/**
 * Tool registration options for runtime configuration
 */
export interface ToolRegistrationOptions {
	/** Skip binary availability checks */
	skipBinaryChecks?: boolean;
	
	/** Only register tools from specific categories */
	categories?: ToolCategory[];
	
	/** Explicitly disabled tool IDs */
	disabledTools?: string[];
	
	/** Custom binary check overrides */
	binaryOverrides?: Map<string, boolean>;
}

/**
 * Tool registration result for tracking success/failure
 */
export interface ToolRegistrationResult {
	/** Tool ID that was registered */
	toolId: string;
	
	/** Whether registration succeeded */
	success: boolean;
	
	/** Error message if registration failed */
	error?: string;
	
	/** Missing binaries that generated warnings */
	missingBinaries?: string[];
}

/**
 * Tool registry statistics for monitoring
 */
export interface ToolRegistryStats {
	/** Total number of registered tools */
	totalTools: number;
	
	/** Tools by category */
	byCategory: Map<ToolCategory, number>;
	
	/** Failed registrations */
	failures: ToolRegistrationResult[];
	
	/** Missing binaries across all tools */
	missingBinaries: Set<string>;
	
	/** Registration time in milliseconds */
	registrationTime: number;
}