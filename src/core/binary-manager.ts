/**
 * Binary dependency management for pi-sherlock tools
 * 
 * Centralizes binary checking and notification logic that was previously
 * scattered across plugin.ts and individual tools.
 */

import { checkBinary } from "../shared/cli";
import type { BinaryRequirement } from "./tool-descriptor";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { AutoInstaller, createAutoInstallConfigs, type AutoInstallerOptions, type InstallationResult } from "./auto-installer";

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
 * Enhanced binary manager options with auto-installation
 */
export interface EnhancedBinaryManagerOptions {
	/** Notification options */
	notifications: BinaryNotificationOptions;
	
	/** Auto-installer options */
	autoInstaller?: AutoInstallerOptions;
	
	/** Whether to enable auto-installation */
	enableAutoInstall: boolean;
}

/**
 * Manages binary dependencies for pi-sherlock tools with auto-installation
 */
export class BinaryManager {
	private checkedBinaries = new Map<string, boolean>();
	private checkOverrides = new Map<string, boolean>();
	private autoInstaller?: AutoInstaller;
	private installationResults = new Map<string, InstallationResult>();
	
	constructor(
		options?: BinaryNotificationOptions | EnhancedBinaryManagerOptions
	) {
		// Handle backward compatibility - if old interface is passed, convert it
		if (options && 'showNotifications' in options) {
			// Old interface (BinaryNotificationOptions)
			this.options = {
				notifications: options,
				enableAutoInstall: false
			};
		} else if (options) {
			// New interface (EnhancedBinaryManagerOptions)
			this.options = options as EnhancedBinaryManagerOptions;
		} else {
			// Default options
			this.options = {
				notifications: {
					showNotifications: true,
					notificationType: 'warning'
				},
				enableAutoInstall: false
			};
		}
		
		if (this.options.enableAutoInstall) {
			this.autoInstaller = new AutoInstaller(this.options.autoInstaller);
		}
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
	 * Send notifications for missing binaries and optionally trigger auto-installation
	 */
	async notifyMissing(
		missing: BinaryRequirement[], 
		context: ExtensionContext
	): Promise<void> {
		if (missing.length === 0) {
			return;
		}
		
		// Try auto-installation first if enabled
		if (this.options.enableAutoInstall && this.autoInstaller) {
			const configs = createAutoInstallConfigs();
			const missingConfigs = configs.filter(config => 
				missing.some(req => req.binary === config.requirement.binary)
			);
			
			if (missingConfigs.length > 0) {
				const results = await this.autoInstaller.autoInstallMissing(missingConfigs, context);
				
				// Store results
				for (const result of results) {
					this.installationResults.set(result.binary, result);
				}
				
				// Update cached binary status for successful installations
				for (const result of results) {
					if (result.success) {
						this.checkedBinaries.set(result.binary, true);
					}
				}
				
				// Filter out successfully installed binaries from missing list
				const stillMissing = missing.filter(req => {
					const result = results.find(r => r.binary === req.binary);
					return !result || !result.success;
				});
				
				missing = stillMissing;
			}
		}
		
		// Send notifications for remaining missing binaries
		if (this.options.notifications.showNotifications && missing.length > 0) {
			for (const requirement of missing) {
				const message = this.formatNotificationMessage(requirement);
				context.ui.notify(
					message,
					this.options.notifications.notificationType
				);
			}
		}
	}
	
	/**
	 * Format notification message for missing binary
	 */
	private formatNotificationMessage(requirement: BinaryRequirement): string {
		if (this.options.notifications.messageTemplate) {
			return this.options.notifications.messageTemplate
				.replace('{binary}', requirement.binary)
				.replace('{label}', requirement.label)
				.replace('{install}', requirement.installCommand);
		}
		
		const required = requirement.required ? 'required' : 'optional';
		const installAction = this.options.enableAutoInstall 
			? 'Auto-installation failed. Manual install:' 
			: 'Install with:';
		
		return `pi-sherlock: ${requirement.label} (${required}) is not available. ${installAction} ${requirement.installCommand}`;
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
	 * Get installation result for a binary
	 */
	getInstallationResult(binary: string): InstallationResult | undefined {
		return this.installationResults.get(binary);
	}
	
	/**
	 * Get all installation results
	 */
	getAllInstallationResults(): InstallationResult[] {
		return Array.from(this.installationResults.values());
	}
	
	/**
	 * Trigger auto-installation for specific binaries
	 */
	async installBinaries(
		binaries: string[],
		context: ExtensionContext
	): Promise<InstallationResult[]> {
		if (!this.autoInstaller) {
			throw new Error('Auto-installation is not enabled');
		}
		
		const configs = createAutoInstallConfigs();
		const targetConfigs = configs.filter(config => 
			binaries.includes(config.requirement.binary)
		);
		
		const results = await this.autoInstaller.autoInstallMissing(targetConfigs, context);
		
		// Store results
		for (const result of results) {
			this.installationResults.set(result.binary, result);
		}
		
		// Update cached binary status for successful installations
		for (const result of results) {
			if (result.success) {
				this.checkedBinaries.set(result.binary, true);
			}
		}
		
		return results;
	}
	
	/**
	 * Get statistics about binary availability and installations
	 */
	getStats(requirements: BinaryRequirement[]): {
		total: number;
		available: number;
		missing: number;
		required: number;
		optional: number;
		installations: {
			attempted: number;
			successful: number;
			failed: number;
			userDeclined: number;
		};
	} {
		const results = this.checkRequirements(requirements);
		const available = results.filter(r => r.available).length;
		const required = requirements.filter(r => r.required).length;
		const optional = requirements.length - required;
		
		const installStats = this.autoInstaller?.getStats() || {
			totalAttempted: 0,
			successful: 0,
			failed: 0,
			userDeclined: 0
		};
		
		return {
			total: requirements.length,
			available,
			missing: results.length - available,
			required,
			optional,
			installations: {
				attempted: installStats.totalAttempted,
				successful: installStats.successful,
				failed: installStats.failed,
				userDeclined: installStats.userDeclined
			}
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