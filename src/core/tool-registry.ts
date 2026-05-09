/**
 * Declarative tool registry for pi-sherlock
 * 
 * Replaces manual tool registration in plugin.ts with a registry-based approach
 * that satisfies the Open/Closed Principle - open for extension, closed for modification.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { 
	ToolDescriptor, 
	ToolRegistrationOptions, 
	ToolRegistrationResult,
	ToolRegistryStats
} from "./tool-descriptor";
import { ToolCategory } from "./tool-descriptor";
import { BinaryManager } from "./binary-manager";

/**
 * Registry for managing tool registration in a declarative way
 */
export class ToolRegistry {
	private tools = new Map<string, ToolDescriptor>();
	private binaryManager: BinaryManager;
	private registrationResults: ToolRegistrationResult[] = [];
	
	constructor(binaryManager?: BinaryManager) {
		this.binaryManager = binaryManager || new BinaryManager();
	}
	
	/**
	 * Register a tool descriptor
	 */
	register(descriptor: ToolDescriptor): void {
		if (this.tools.has(descriptor.id)) {
			throw new Error(`Tool '${descriptor.id}' is already registered`);
		}
		
		// Validate descriptor
		this.validateDescriptor(descriptor);
		
		this.tools.set(descriptor.id, descriptor);
	}
	
	/**
	 * Register multiple tool descriptors
	 */
	registerAll(descriptors: ToolDescriptor[]): void {
		for (const descriptor of descriptors) {
			this.register(descriptor);
		}
	}
	
	/**
	 * Get all registered tool descriptors
	 */
	getAllTools(): ToolDescriptor[] {
		return Array.from(this.tools.values());
	}
	
	/**
	 * Get tools by category
	 */
	getToolsByCategory(category: ToolCategory): ToolDescriptor[] {
		return Array.from(this.tools.values())
			.filter(tool => tool.category === category);
	}
	
	/**
	 * Get tool by ID
	 */
	getTool(id: string): ToolDescriptor | undefined {
		return this.tools.get(id);
	}
	
	/**
	 * Check if tool is registered
	 */
	hasTool(id: string): boolean {
		return this.tools.has(id);
	}
	
	/**
	 * Load prompt file for a tool
	 */
	private loadPromptFile(promptFile: string): string {
		try {
			const fullPath = resolve(promptFile);
			return readFileSync(fullPath, 'utf-8');
		} catch (error) {
			throw new Error(
				`Failed to load prompt file '${promptFile}': ${error instanceof Error ? error.message : error}`
			);
		}
	}
	
	/**
	 * Check tool dependencies are satisfied
	 */
	private checkDependencies(descriptor: ToolDescriptor): string[] {
		const missing: string[] = [];
		
		if (descriptor.dependencies) {
			for (const depId of descriptor.dependencies) {
				if (!this.tools.has(depId)) {
					missing.push(depId);
				}
			}
		}
		
		return missing;
	}
	
	/**
	 * Load and register all tools with ExtensionAPI
	 */
	async loadAndRegisterAll(
		api: ExtensionAPI, 
		context: ExtensionContext,
		options: ToolRegistrationOptions = {}
	): Promise<ToolRegistryStats> {
		const startTime = Date.now();
		this.registrationResults = [];
		
		const tools = this.getEnabledTools(options);
		const sortedTools = this.sortByDependencies(tools);
		
		// Check binary requirements across all tools
		const allBinaries = this.getAllBinaryRequirements(tools);
		if (!options.skipBinaryChecks) {
			const missing = this.binaryManager.getMissingRequirements(allBinaries);
			this.binaryManager.notifyMissing(missing, context);
		}
		
		// Register tools in dependency order
		for (const tool of sortedTools) {
			const result = await this.registerTool(api, tool, options);
			this.registrationResults.push(result);
		}
		
		const registrationTime = Date.now() - startTime;
		
		return this.getStats(registrationTime);
	}
	
	/**
	 * Register a single tool with the ExtensionAPI
	 */
	private async registerTool(
		api: ExtensionAPI,
		descriptor: ToolDescriptor,
		options: ToolRegistrationOptions
	): Promise<ToolRegistrationResult> {
		try {
			// Check dependencies
			const missingDeps = this.checkDependencies(descriptor);
			if (missingDeps.length > 0) {
				return {
					toolId: descriptor.id,
					success: false,
					error: `Missing dependencies: ${missingDeps.join(', ')}`
				};
			}
			
			// Check binary requirements
			const missingBinaries: string[] = [];
			if (descriptor.binaries && !options.skipBinaryChecks) {
				const missing = this.binaryManager.getMissingRequirements(
					descriptor.binaries.filter(b => b.required)
				);
				missingBinaries.push(...missing.map(b => b.binary));
			}
			
			// Load prompt file
			const description = this.loadPromptFile(descriptor.promptFile);
			
			// Register with ExtensionAPI
			descriptor.registerFn(api, description);
			
			return {
				toolId: descriptor.id,
				success: true,
				missingBinaries: missingBinaries.length > 0 ? missingBinaries : undefined
			};
			
		} catch (error) {
			return {
				toolId: descriptor.id,
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	
	/**
	 * Get enabled tools based on options
	 */
	private getEnabledTools(options: ToolRegistrationOptions): ToolDescriptor[] {
		return Array.from(this.tools.values()).filter(tool => {
			// Check if explicitly disabled
			if (options.disabledTools?.includes(tool.id)) {
				return false;
			}
			
			// Check category filter
			if (options.categories && !options.categories.includes(tool.category)) {
				return false;
			}
			
			// Check enabled flag
			if (tool.enabled === false) {
				return false;
			}
			
			return true;
		});
	}
	
	/**
	 * Sort tools by dependency order (dependencies first)
	 */
	private sortByDependencies(tools: ToolDescriptor[]): ToolDescriptor[] {
		const sorted: ToolDescriptor[] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();
		
		const visit = (tool: ToolDescriptor) => {
			if (visiting.has(tool.id)) {
				throw new Error(`Circular dependency detected: ${tool.id}`);
			}
			if (visited.has(tool.id)) {
				return;
			}
			
			visiting.add(tool.id);
			
			// Visit dependencies first
			if (tool.dependencies) {
				for (const depId of tool.dependencies) {
					const dep = this.tools.get(depId);
					if (dep) {
						visit(dep);
					}
				}
			}
			
			visiting.delete(tool.id);
			visited.add(tool.id);
			sorted.push(tool);
		};
		
		for (const tool of tools) {
			visit(tool);
		}
		
		return sorted;
	}
	
	/**
	 * Get all binary requirements across tools
	 */
	private getAllBinaryRequirements(tools: ToolDescriptor[]) {
		const allBinaries = new Map<string, BinaryRequirement>();
		
		for (const tool of tools) {
			if (tool.binaries) {
				for (const binary of tool.binaries) {
					allBinaries.set(binary.binary, binary);
				}
			}
		}
		
		return Array.from(allBinaries.values());
	}
	
	/**
	 * Validate tool descriptor
	 */
	private validateDescriptor(descriptor: ToolDescriptor): void {
		if (!descriptor.id) {
			throw new Error('Tool descriptor must have an id');
		}
		
		if (!descriptor.registerFn) {
			throw new Error(`Tool '${descriptor.id}' must have a registerFn`);
		}
		
		if (!descriptor.promptFile) {
			throw new Error(`Tool '${descriptor.id}' must have a promptFile`);
		}
		
		if (!Object.values(ToolCategory).includes(descriptor.category)) {
			throw new Error(`Tool '${descriptor.id}' has invalid category: ${descriptor.category}`);
		}
	}
	
	/**
	 * Get registry statistics
	 */
	private getStats(registrationTime: number): ToolRegistryStats {
		const successful = this.registrationResults.filter(r => r.success);
		const failed = this.registrationResults.filter(r => !r.success);
		
		const byCategory = new Map<ToolCategory, number>();
		for (const result of successful) {
			const tool = this.tools.get(result.toolId);
			if (tool) {
				const count = byCategory.get(tool.category) || 0;
				byCategory.set(tool.category, count + 1);
			}
		}
		
		const missingBinaries = new Set<string>();
		for (const result of this.registrationResults) {
			if (result.missingBinaries) {
				result.missingBinaries.forEach(b => missingBinaries.add(b));
			}
		}
		
		return {
			totalTools: successful.length,
			byCategory,
			failures: failed,
			missingBinaries,
			registrationTime
		};
	}
	
	/**
	 * Clear all registered tools
	 */
	clear(): void {
		this.tools.clear();
		this.registrationResults = [];
	}
	
	/**
	 * Get binary manager instance
	 */
	getBinaryManager(): BinaryManager {
		return this.binaryManager;
	}
}