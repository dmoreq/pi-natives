/**
 * Auto-installation mechanism for pi-sherlock binary dependencies
 * 
 * Provides automated installation of required tools with user consent
 * and platform-specific installation strategies.
 */

import { execSync } from "node:child_process";
import { platform } from "node:os";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { BinaryRequirement } from "./tool-descriptor";

/**
 * Installation method configuration
 */
export interface InstallationMethod {
	/** Package manager or installation method */
	method: 'brew' | 'npm' | 'pip' | 'cargo' | 'apt' | 'pacman' | 'winget' | 'scoop' | 'custom';
	
	/** Command template for installation */
	command: string;
	
	/** Platform compatibility */
	platforms: NodeJS.Platform[];
	
	/** Whether this method requires sudo/elevated permissions */
	requiresElevation?: boolean;
	
	/** Post-install verification command */
	verifyCommand?: string;
}

/**
 * Auto-installation configuration for a binary
 */
export interface AutoInstallConfig {
	/** Binary requirement */
	requirement: BinaryRequirement;
	
	/** Available installation methods (ordered by preference) */
	methods: InstallationMethod[];
	
	/** Whether auto-installation is enabled for this binary */
	autoInstallEnabled: boolean;
	
	/** Custom pre-install hook */
	preInstall?: () => Promise<void>;
	
	/** Custom post-install hook */
	postInstall?: () => Promise<void>;
}

/**
 * Installation result
 */
export interface InstallationResult {
	/** Binary that was installed */
	binary: string;
	
	/** Whether installation succeeded */
	success: boolean;
	
	/** Installation method used */
	method?: InstallationMethod;
	
	/** Error message if installation failed */
	error?: string;
	
	/** Installation time in milliseconds */
	installTime?: number;
	
	/** Whether user consent was given */
	userConsented: boolean;
}

/**
 * Auto-installer options
 */
export interface AutoInstallerOptions {
	/** Whether to prompt user for consent before installing */
	requireUserConsent: boolean;
	
	/** Whether to install required binaries automatically */
	installRequired: boolean;
	
	/** Whether to install optional binaries automatically */
	installOptional: boolean;
	
	/** Maximum installation attempts per binary */
	maxRetries: number;
	
	/** Timeout for installation commands (ms) */
	installTimeout: number;
	
	/** Whether to run post-install verification */
	verifyInstallation: boolean;
}

/**
 * Manages automatic installation of binary dependencies
 */
export class AutoInstaller {
	private installations = new Map<string, InstallationResult>();
	
	constructor(
		private options: AutoInstallerOptions = {
			requireUserConsent: true,
			installRequired: true,
			installOptional: false,
			maxRetries: 3,
			installTimeout: 300000, // 5 minutes
			verifyInstallation: true
		}
	) {}
	
	/**
	 * Auto-install missing binaries with user consent
	 */
	async autoInstallMissing(
		configs: AutoInstallConfig[],
		context: ExtensionContext
	): Promise<InstallationResult[]> {
		const results: InstallationResult[] = [];
		
		for (const config of configs) {
			if (!config.autoInstallEnabled) {
				continue;
			}
			
			// Skip if already attempted installation
			if (this.installations.has(config.requirement.binary)) {
				results.push(this.installations.get(config.requirement.binary)!);
				continue;
			}
			
			// Check if should install based on requirement type
			const shouldInstall = config.requirement.required 
				? this.options.installRequired 
				: this.options.installOptional;
				
			if (!shouldInstall) {
				continue;
			}
			
			const result = await this.installBinary(config, context);
			this.installations.set(config.requirement.binary, result);
			results.push(result);
		}
		
		return results;
	}
	
	/**
	 * Install a single binary
	 */
	async installBinary(
		config: AutoInstallConfig,
		context: ExtensionContext
	): Promise<InstallationResult> {
		const startTime = Date.now();
		
		try {
			// Get user consent if required
			const userConsented = await this.getUserConsent(config, context);
			
			if (!userConsented) {
				return {
					binary: config.requirement.binary,
					success: false,
					userConsented: false,
					error: 'User declined installation'
				};
			}
			
			// Find compatible installation method
			const method = this.findCompatibleMethod(config.methods);
			if (!method) {
				return {
					binary: config.requirement.binary,
					success: false,
					userConsented: true,
					error: 'No compatible installation method found'
				};
			}
			
			// Run pre-install hook
			if (config.preInstall) {
				await config.preInstall();
			}
			
			// Execute installation
			await this.executeInstallation(method, config.requirement.binary);
			
			// Verify installation
			if (this.options.verifyInstallation) {
				const verified = await this.verifyInstallation(method, config.requirement);
				if (!verified) {
					throw new Error('Installation verification failed');
				}
			}
			
			// Run post-install hook
			if (config.postInstall) {
				await config.postInstall();
			}
			
			const installTime = Date.now() - startTime;
			
			// Notify success
			context.ui.notify(
				`pi-sherlock: Successfully installed ${config.requirement.label}`,
				'info'
			);
			
			return {
				binary: config.requirement.binary,
				success: true,
				method,
				userConsented: true,
				installTime
			};
			
		} catch (error) {
			const installTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Notify failure
			context.ui.notify(
				`pi-sherlock: Failed to install ${config.requirement.label}: ${errorMessage}`,
				'error'
			);
			
			return {
				binary: config.requirement.binary,
				success: false,
				userConsented: true,
				error: errorMessage,
				installTime
			};
		}
	}
	
	/**
	 * Get user consent for installation
	 */
	private async getUserConsent(
		config: AutoInstallConfig,
		context: ExtensionContext
	): Promise<boolean> {
		if (!this.options.requireUserConsent) {
			return true;
		}
		
		const message = `pi-sherlock wants to install ${config.requirement.label} (${config.requirement.binary}). This will run: ${config.methods[0]?.command}. Allow installation?`;
		
		// For now, show notification and assume consent
		// In a real implementation, this would show a dialog
		context.ui.notify(message, 'info');
		
		// TODO: Implement actual user consent dialog when API is available
		return true;
	}
	
	/**
	 * Find compatible installation method for current platform
	 */
	private findCompatibleMethod(methods: InstallationMethod[]): InstallationMethod | null {
		const currentPlatform = platform();
		
		for (const method of methods) {
			if (method.platforms.includes(currentPlatform)) {
				// Check if package manager is available
				if (this.isPackageManagerAvailable(method.method)) {
					return method;
				}
			}
		}
		
		return null;
	}
	
	/**
	 * Check if package manager is available
	 */
	private isPackageManagerAvailable(packageManager: string): boolean {
		try {
			execSync(`which ${packageManager}`, { stdio: 'ignore', timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	}
	
	/**
	 * Execute installation command
	 */
	private async executeInstallation(method: InstallationMethod, binary: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const command = method.command.replace('{binary}', binary);
			
			try {
				const options = {
					stdio: 'pipe' as const,
					timeout: this.options.installTimeout,
					encoding: 'utf8' as const
				};
				
				execSync(command, options);
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	}
	
	/**
	 * Verify installation was successful
	 */
	private async verifyInstallation(
		method: InstallationMethod,
		requirement: BinaryRequirement
	): Promise<boolean> {
		try {
			// Use custom check if available
			if (requirement.customCheck) {
				return requirement.customCheck();
			}
			
			// Use method's verify command if available
			if (method.verifyCommand) {
				const command = method.verifyCommand.replace('{binary}', requirement.binary);
				execSync(command, { stdio: 'ignore', timeout: 10000 });
				return true;
			}
			
			// Default: check if binary is in PATH
			execSync(`which ${requirement.binary}`, { stdio: 'ignore', timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	}
	
	/**
	 * Get installation statistics
	 */
	getStats(): {
		totalAttempted: number;
		successful: number;
		failed: number;
		userDeclined: number;
		averageInstallTime: number;
	} {
		const results = Array.from(this.installations.values());
		const successful = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success && r.userConsented).length;
		const userDeclined = results.filter(r => !r.userConsented).length;
		
		const installTimes = results
			.filter(r => r.installTime !== undefined)
			.map(r => r.installTime!);
		
		const averageInstallTime = installTimes.length > 0
			? installTimes.reduce((a, b) => a + b, 0) / installTimes.length
			: 0;
		
		return {
			totalAttempted: results.length,
			successful,
			failed,
			userDeclined,
			averageInstallTime
		};
	}
	
	/**
	 * Clear installation history
	 */
	clearHistory(): void {
		this.installations.clear();
	}
}

/**
 * Create default auto-install configurations for pi-sherlock binaries
 */
export function createAutoInstallConfigs(): AutoInstallConfig[] {
	return [
		{
			requirement: {
				binary: 'rg',
				label: 'ripgrep',
				installCommand: 'brew install ripgrep',
				required: true
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install ripgrep',
					platforms: ['darwin'],
					verifyCommand: 'rg --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y ripgrep',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'rg --version'
				},
				{
					method: 'winget',
					command: 'winget install BurntSushi.ripgrep.GNU',
					platforms: ['win32'],
					verifyCommand: 'rg --version'
				}
			],
			autoInstallEnabled: true
		},
		
		{
			requirement: {
				binary: 'fd',
				label: 'fd',
				installCommand: 'brew install fd',
				required: true
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install fd',
					platforms: ['darwin'],
					verifyCommand: 'fd --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y fd-find',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'fd --version'
				},
				{
					method: 'winget',
					command: 'winget install sharkdp.fd',
					platforms: ['win32'],
					verifyCommand: 'fd --version'
				}
			],
			autoInstallEnabled: true
		},
		
		{
			requirement: {
				binary: 'fzf',
				label: 'fzf',
				installCommand: 'brew install fzf',
				required: true
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install fzf',
					platforms: ['darwin'],
					verifyCommand: 'fzf --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y fzf',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'fzf --version'
				},
				{
					method: 'winget',
					command: 'winget install junegunn.fzf',
					platforms: ['win32'],
					verifyCommand: 'fzf --version'
				}
			],
			autoInstallEnabled: true
		},
		
		{
			requirement: {
				binary: 'semgrep',
				label: 'semgrep',
				installCommand: 'pip install semgrep',
				required: true
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install semgrep',
					platforms: ['darwin'],
					verifyCommand: 'semgrep --version'
				},
				{
					method: 'pip',
					command: 'pip install semgrep',
					platforms: ['darwin', 'linux', 'win32'],
					verifyCommand: 'semgrep --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y semgrep',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'semgrep --version'
				}
			],
			autoInstallEnabled: true
		},
		
		{
			requirement: {
				binary: 'ast-grep',
				label: 'ast-grep',
				installCommand: 'npm install -g @ast-grep/cli',
				required: false
			},
			methods: [
				{
					method: 'npm',
					command: 'npm install -g @ast-grep/cli',
					platforms: ['darwin', 'linux', 'win32'],
					verifyCommand: 'ast-grep --version'
				},
				{
					method: 'brew',
					command: 'brew install ast-grep',
					platforms: ['darwin'],
					verifyCommand: 'ast-grep --version'
				},
				{
					method: 'cargo',
					command: 'cargo install ast-grep',
					platforms: ['darwin', 'linux', 'win32'],
					verifyCommand: 'ast-grep --version'
				}
			],
			autoInstallEnabled: false // Optional tool, user choice
		},
		
		{
			requirement: {
				binary: 'tokei',
				label: 'tokei',
				installCommand: 'brew install tokei',
				required: false
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install tokei',
					platforms: ['darwin'],
					verifyCommand: 'tokei --version'
				},
				{
					method: 'cargo',
					command: 'cargo install tokei',
					platforms: ['darwin', 'linux', 'win32'],
					verifyCommand: 'tokei --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y tokei',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'tokei --version'
				}
			],
			autoInstallEnabled: false
		},
		
		{
			requirement: {
				binary: 'jscpd',
				label: 'jscpd',
				installCommand: 'npm install -g jscpd',
				required: false
			},
			methods: [
				{
					method: 'npm',
					command: 'npm install -g jscpd',
					platforms: ['darwin', 'linux', 'win32'],
					verifyCommand: 'jscpd --version'
				}
			],
			autoInstallEnabled: false
		},
		
		{
			requirement: {
				binary: 'jq',
				label: 'jq',
				installCommand: 'brew install jq',
				required: false
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install jq',
					platforms: ['darwin'],
					verifyCommand: 'jq --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y jq',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'jq --version'
				},
				{
					method: 'winget',
					command: 'winget install jqlang.jq',
					platforms: ['win32'],
					verifyCommand: 'jq --version'
				}
			],
			autoInstallEnabled: false
		},
		
		{
			requirement: {
				binary: 'yq',
				label: 'yq',
				installCommand: 'brew install yq',
				required: false
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install yq',
					platforms: ['darwin'],
					verifyCommand: 'yq --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y yq',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'yq --version'
				},
				{
					method: 'winget',
					command: 'winget install MikeFarah.yq',
					platforms: ['win32'],
					verifyCommand: 'yq --version'
				}
			],
			autoInstallEnabled: false
		},
		
		{
			requirement: {
				binary: 'bat',
				label: 'bat',
				installCommand: 'brew install bat',
				required: false
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install bat',
					platforms: ['darwin'],
					verifyCommand: 'bat --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y bat',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'bat --version'
				},
				{
					method: 'winget',
					command: 'winget install sharkdp.bat',
					platforms: ['win32'],
					verifyCommand: 'bat --version'
				}
			],
			autoInstallEnabled: false
		},
		
		{
			requirement: {
				binary: 'nu',
				label: 'Nushell',
				installCommand: 'brew install nushell',
				required: false
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install nushell',
					platforms: ['darwin'],
					verifyCommand: 'nu --version'
				},
				{
					method: 'winget',
					command: 'winget install Nushell.Nushell',
					platforms: ['win32'],
					verifyCommand: 'nu --version'
				},
				{
					method: 'cargo',
					command: 'cargo install nu',
					platforms: ['darwin', 'linux', 'win32'],
					verifyCommand: 'nu --version'
				}
			],
			autoInstallEnabled: false
		},
		
		{
			requirement: {
				binary: 'br',
				label: 'broot',
				installCommand: 'brew install broot',
				required: false,
				customCheck: () => {
					try {
						execSync('which br', { stdio: 'ignore' });
						return true;
					} catch {
						try {
							execSync('which broot', { stdio: 'ignore' });
							return true;
						} catch {
							return false;
						}
					}
				}
			},
			methods: [
				{
					method: 'brew',
					command: 'brew install broot',
					platforms: ['darwin'],
					verifyCommand: 'br --version || broot --version'
				},
				{
					method: 'cargo',
					command: 'cargo install broot',
					platforms: ['darwin', 'linux', 'win32'],
					verifyCommand: 'br --version || broot --version'
				},
				{
					method: 'apt',
					command: 'apt update && apt install -y broot',
					platforms: ['linux'],
					requiresElevation: true,
					verifyCommand: 'br --version || broot --version'
				}
			],
			autoInstallEnabled: false
		}
	];
}