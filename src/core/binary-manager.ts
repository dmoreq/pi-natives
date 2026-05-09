/**
 * Binary dependency management for pi-sherlock tools
 * 
 * Centralizes binary checking and notification logic that was previously
 * scattered across plugin.ts and individual tools.
 */

import { checkBinary } from "../shared/cli";
import type { BinaryRequirement } from "./tool-descriptor";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

/**
 * Result of binary availability check
 */
export interface BinaryCheckResult {
	/** Binary name that was checked */
	binary: string;
	
	/** Whether binary is available */
	available: boolean;
	
	/** Error message if check failed */
	error?: string;
}

/**
 * Binary notification configuration
 */
export interface BinaryNotificationOptions {
	/** Whether to show notifications for missing binaries */
	showNotifications: boolean;
	
	/** Custom notification message template */
	messageTemplate?: string;
	
	/** Notification type ('info' | 'warning' | 'error') */
	notificationType: 'info' | 'warning' | 'error';
}

/**
 * Manages binary dependencies for pi-sherlock tools
 */
export class BinaryManager {
	private checkedBinaries = new Map<string, boolean>();
	private checkOverrides = new Map<string, boolean>();
	private options: BinaryNotificationOptions;
	
	constructor(options?: BinaryNotificationOptions) {
		this.options = options || {
			showNotifications: true,
			notificationType: 'warning'
		};
	}
	
	/**
	 * Check if a binary is available
	 */
	isAvailable(requirement: BinaryRequirement): BinaryCheckResult {
		// Check override first (prioritize over cache)
		if (this.checkOverrides.has(requirement.binary)) {
			const available = this.checkOverrides.get(requirement.binary)!;
			return {
				binary: requirement.binary,
				available
			};
		}
		
		// Use cached result if available
		if (this.checkedBinaries.has(requirement.binary)) {
			const available = this.checkedBinaries.get(requirement.binary)!;
			return {
				binary: requirement.binary,
				available
			};
		}
		
		try {
			const available = requirement.customCheck 
				? requirement.customCheck()
				: !!checkBinary(requirement.binary); // Convert to boolean
			
			// Cache result
			this.checkedBinaries.set(requirement.binary, available);
			
			return {
				binary: requirement.binary,
				available
			};
		} catch (error) {
			const available = false;
			this.checkedBinaries.set(requirement.binary, available);
			
			return {
				binary: requirement.binary,
				available,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	
	/**
	 * Check multiple binary requirements
	 */
	checkRequirements(requirements: BinaryRequirement[]): BinaryCheckResult[] {
		return requirements.map(req => this.isAvailable(req));
	}
	
	/**
	 * Get all missing binary requirements
	 */
	getMissingRequirements(requirements: BinaryRequirement[]): BinaryRequirement[] {
		return requirements.filter(req => !this.isAvailable(req).available);
	}
	
	/**
	 * Send notifications for missing binaries
	 */
	async notifyMissing(
		missing: BinaryRequirement[], 
		context: ExtensionContext
	): Promise<void> {
		if (missing.length === 0 || !this.options.showNotifications) {
			return;
		}
		
		for (const requirement of missing) {
			const message = this.formatNotificationMessage(requirement);
			context.ui.notify(
				message,
				this.options.notificationType
			);
		}
	}
	
	/**
	 * Format notification message for missing binary
	 */
	private formatNotificationMessage(requirement: BinaryRequirement): string {
		if (this.options.messageTemplate) {
			return this.options.messageTemplate
				.replace('{binary}', requirement.binary)
				.replace('{label}', requirement.label)
				.replace('{install}', requirement.installCommand);
		}
		
		const required = requirement.required ? 'required' : 'optional';
		return `pi-sherlock: ${requirement.label} (${required}) is not available. Install with: ${requirement.installCommand}`;
	}
	
	/**
	 * Override binary check result for testing
	 */
	setBinaryOverride(binary: string, available: boolean): void {
		this.checkOverrides.set(binary, available);
	}
	
	/**
	 * Clear binary check overrides
	 */
	clearOverrides(): void {
		this.checkOverrides.clear();
	}
	
	/**
	 * Clear cached binary check results
	 */
	clearCache(): void {
		this.checkedBinaries.clear();
	}
	
	/**
	 * Get statistics about binary availability
	 */
	getStats(requirements: BinaryRequirement[]): {
		total: number;
		available: number;
		missing: number;
		required: number;
		optional: number;
	} {
		const results = this.checkRequirements(requirements);
		const available = results.filter(r => r.available).length;
		const required = requirements.filter(r => r.required).length;
		const optional = requirements.length - required;
		
		return {
			total: requirements.length,
			available,
			missing: results.length - available,
			required,
			optional
		};
	}
}

/**
 * Create common binary requirements for pi-sherlock tools
 */
export function createBinaryRequirements(): {
	// Core search tools
	ripgrep: BinaryRequirement;
	fd: BinaryRequirement;
	fzf: BinaryRequirement;
	
	// Code analysis tools  
	semgrep: BinaryRequirement;
	astGrep: BinaryRequirement;
	tokei: BinaryRequirement;
	jscpd: BinaryRequirement;
	
	// Enhanced tool dependencies
	jq: BinaryRequirement;
	yq: BinaryRequirement;
	bat: BinaryRequirement;
	nushell: BinaryRequirement;
	broot: BinaryRequirement;
} {
	return {
		ripgrep: {
			binary: 'rg',
			label: 'ripgrep',
			installCommand: '`brew install ripgrep`',
			required: true
		},
		
		fd: {
			binary: 'fd',
			label: 'fd',
			installCommand: '`brew install fd`',
			required: true
		},
		
		fzf: {
			binary: 'fzf',
			label: 'fzf',
			installCommand: '`brew install fzf`',
			required: true
		},
		
		semgrep: {
			binary: 'semgrep',
			label: 'semgrep', 
			installCommand: '`brew install semgrep` or `pip install semgrep`',
			required: true
		},
		
		astGrep: {
			binary: 'ast-grep',
			label: 'ast-grep',
			installCommand: '`npm install -g @ast-grep/cli`',
			required: false
		},
		
		tokei: {
			binary: 'tokei',
			label: 'tokei',
			installCommand: '`brew install tokei`',
			required: false
		},
		
		jscpd: {
			binary: 'jscpd',
			label: 'jscpd', 
			installCommand: '`npm install -g jscpd`',
			required: false
		},
		
		jq: {
			binary: 'jq',
			label: 'jq',
			installCommand: '`brew install jq`',
			required: false
		},
		
		yq: {
			binary: 'yq',
			label: 'yq (mikefarah)',
			installCommand: '`brew install yq`',
			required: false
		},
		
		bat: {
			binary: 'bat',
			label: 'bat',
			installCommand: '`brew install bat`',
			required: false
		},
		
		nushell: {
			binary: 'nu',
			label: 'Nushell',
			installCommand: '`brew install nushell` or see https://www.nushell.sh',
			required: false
		},
		
		broot: {
			binary: 'br',
			label: 'broot',
			installCommand: '`brew install broot`',
			required: false,
			customCheck: () => {
				// Check for either 'br' or 'broot' binary
				return checkBinary('br') || checkBinary('broot');
			}
		}
	};
}