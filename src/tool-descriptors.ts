/**
 * Tool descriptor registry for pi-sherlock tools
 * 
 * This demonstrates the declarative tool registration approach
 * that replaces manual registration in plugin.ts
 */

import type { ToolDescriptor } from "./core/tool-descriptor";
import { ToolCategory } from "./core/tool-descriptor";
import { createBinaryRequirements } from "./core/binary-manager";

// Import existing tool registration functions
import { registerReadEnhancedTool } from "./tools/read-enhanced";
import { registerWriteEnhancedTool } from "./tools/write-enhanced";
import { registerEditEnhancedTool } from "./tools/edit-enhanced";
import { registerShellEnhancedTool } from "./tools/shell-enhanced";
import { registerLsEnhancedTool } from "./tools/ls-enhanced";

// Import existing tool registration functions (legacy)
import { registerRipgrepTool } from "./tools/ripgrep";
import { registerFdTool } from "./tools/fd";
import { registerFzfTool } from "./tools/fzf";
import { registerSemgrepTool } from "./tools/semgrep";
import { registerAstGrepTool } from "./tools/ast-grep";
import { registerTokeiTool } from "./tools/tokei";
import { registerJscpdTool } from "./tools/jscpd";
import { registerInstallToolsTool } from "./tools/install-tools";

// Get common binary requirements
const binaries = createBinaryRequirements();

/**
 * Enhanced core tool descriptors
 */
export const enhancedCoreTools: ToolDescriptor[] = [
	{
		id: "read-enhanced",
		category: ToolCategory.ENHANCED_CORE,
		registerFn: registerReadEnhancedTool,
		promptFile: "prompts/read-enhanced.md",
		binaries: [binaries.jq, binaries.yq, binaries.astGrep, binaries.bat],
		version: "2.0.0",
		enabled: true
	},
	
	{
		id: "write-enhanced", 
		category: ToolCategory.ENHANCED_CORE,
		registerFn: registerWriteEnhancedTool,
		promptFile: "prompts/write-enhanced.md",
		version: "2.0.0",
		enabled: true
	},
	
	{
		id: "edit-enhanced",
		category: ToolCategory.ENHANCED_CORE,
		registerFn: registerEditEnhancedTool,
		promptFile: "prompts/edit-enhanced.md",
		binaries: [binaries.astGrep],
		version: "2.0.0", 
		enabled: true
	},
	
	{
		id: "shell-enhanced",
		category: ToolCategory.ENHANCED_CORE,
		registerFn: registerShellEnhancedTool,
		promptFile: "prompts/shell-enhanced.md",
		binaries: [binaries.nushell],
		version: "2.0.0",
		enabled: true
	},
	
	{
		id: "ls-enhanced",
		category: ToolCategory.ENHANCED_CORE,
		registerFn: registerLsEnhancedTool,
		promptFile: "prompts/ls-enhanced.md",
		binaries: [binaries.broot],
		version: "2.0.0",
		enabled: true
	},

];

/**
 * Search tool descriptors
 */
export const searchTools: ToolDescriptor[] = [
	{
		id: "ripgrep",
		category: ToolCategory.SEARCH,
		registerFn: registerRipgrepTool,
		promptFile: "prompts/ripgrep.md",
		binaries: [binaries.ripgrep],
		version: "1.0.0",
		enabled: true
	},
	
	{
		id: "fd",
		category: ToolCategory.SEARCH,
		registerFn: registerFdTool,
		promptFile: "prompts/fd.md", 
		binaries: [binaries.fd],
		version: "1.0.0",
		enabled: true
	},
	
	{
		id: "fzf",
		category: ToolCategory.SEARCH,
		registerFn: registerFzfTool,
		promptFile: "prompts/fzf.md",
		binaries: [binaries.fzf],
		version: "1.0.0",
		enabled: true
	}
];

/**
 * Code analysis tool descriptors
 */
export const codeAnalysisTools: ToolDescriptor[] = [
	{
		id: "semgrep",
		category: ToolCategory.CODE_ANALYSIS,
		registerFn: registerSemgrepTool,
		promptFile: "prompts/semgrep.md",
		binaries: [binaries.semgrep],
		version: "1.0.0",
		enabled: true
	},
	
	{
		id: "ast-grep",
		category: ToolCategory.CODE_ANALYSIS,
		registerFn: registerAstGrepTool,
		promptFile: "prompts/ast-grep.md",
		binaries: [binaries.astGrep],
		version: "1.0.0", 
		enabled: true
	},
	
	{
		id: "tokei",
		category: ToolCategory.CODE_ANALYSIS,
		registerFn: registerTokeiTool,
		promptFile: "prompts/tokei.md",
		binaries: [binaries.tokei],
		version: "1.0.0",
		enabled: true
	},
	
	{
		id: "jscpd",
		category: ToolCategory.CODE_ANALYSIS,
		registerFn: registerJscpdTool,
		promptFile: "prompts/jscpd.md",
		binaries: [binaries.jscpd],
		version: "1.0.0",
		enabled: true
	}
];

/**
 * Utility tool descriptors for maintenance and setup
 */
export const utilityTools: ToolDescriptor[] = [
	{
		id: "install-tools",
		category: ToolCategory.UTILITY,
		registerFn: registerInstallToolsTool,
		promptFile: "prompts/install-tools.md",
		version: "1.0.0",
		enabled: true
	}
];

/**
 * All tool descriptors organized by priority
 */
export const allToolDescriptors: ToolDescriptor[] = [
	...enhancedCoreTools,    // Highest priority - enhanced tools
	...searchTools,          // Core search functionality
	...codeAnalysisTools,    // Advanced analysis features
	...utilityTools          // Utility and maintenance tools
];

/**
 * Tool descriptors organized by category for easy filtering
 */
export const toolDescriptorsByCategory = {
	[ToolCategory.ENHANCED_CORE]: enhancedCoreTools,
	[ToolCategory.SEARCH]: searchTools,
	[ToolCategory.CODE_ANALYSIS]: codeAnalysisTools,
	[ToolCategory.FILE_OPS]: [], // Reserved for future file operation tools
	[ToolCategory.UTILITY]: utilityTools
} as const;

/**
 * Get tool descriptors by category
 */
export function getToolsByCategory(category: ToolCategory): ToolDescriptor[] {
	return toolDescriptorsByCategory[category] || [];
}

/**
 * Get all enhanced core tools (priority tools)
 */
export function getEnhancedCoreTools(): ToolDescriptor[] {
	return enhancedCoreTools;
}

/**
 * Get all analysis tools
 */
export function getAnalysisTools(): ToolDescriptor[] {
	return [...searchTools, ...codeAnalysisTools];
}

/**
 * Create a filtered tool set based on binary availability
 */
export function createFilteredToolSet(
	availableBinaries: Set<string>
): ToolDescriptor[] {
	return allToolDescriptors.filter(tool => {
		if (!tool.binaries) return true; // No binary requirements
		
		// Check if all required binaries are available
		const requiredBinaries = tool.binaries.filter(b => b.required);
		return requiredBinaries.every(binary => 
			availableBinaries.has(binary.binary)
		);
	});
}

/**
 * Tool metadata for display and management
 */
export const toolMetadata = {
	totalTools: allToolDescriptors.length,
	enhancedCoreCount: enhancedCoreTools.length,
	searchToolCount: searchTools.length,
	analysisToolCount: codeAnalysisTools.length,
	
	// Binary dependency statistics
	totalBinaries: new Set(
		allToolDescriptors
			.flatMap(t => t.binaries || [])
			.map(b => b.binary)
	).size,
	
	requiredBinaries: new Set(
		allToolDescriptors
			.flatMap(t => t.binaries?.filter(b => b.required) || [])
			.map(b => b.binary)
	).size,
	
	optionalBinaries: new Set(
		allToolDescriptors
			.flatMap(t => t.binaries?.filter(b => !b.required) || [])
			.map(b => b.binary)
	).size
} as const;