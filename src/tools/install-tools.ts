/**
 * Manual tool installation command for pi-sherlock
 * 
 * Allows users to trigger installation of missing binaries on demand.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BinaryManager, createBinaryRequirements } from "../core/binary-manager";
import { createAutoInstallConfigs } from "../core/auto-installer";

/**
 * Register the install_tools command
 */
export function registerInstallToolsTool(api: ExtensionAPI, description: string): void {
	api.registerTool(
		"install_tools", 
		description,
		{
			binaries: {
				type: "array",
				items: { type: "string" },
				description: "Specific binaries to install. If empty, installs all missing required tools."
			},
			required_only: {
				type: "boolean", 
				description: "Only install required tools, skip optional ones.",
				default: false
			},
			force: {
				type: "boolean",
				description: "Force reinstall even if binary already exists.",
				default: false  
			}
		},
		async (args, context) => {
			const { binaries = [], required_only = false, force = false } = args;
			
			try {
				// Create enhanced binary manager with auto-installation enabled
				const binaryManager = new BinaryManager({
					notifications: {
						showNotifications: true,
						notificationType: 'info'
					},
					enableAutoInstall: true,
					autoInstaller: {
						requireUserConsent: false, // Direct user command, skip consent
						installRequired: true,
						installOptional: !required_only,
						maxRetries: 3,
						installTimeout: 300000, // 5 minutes
						verifyInstallation: true
					}
				});
				
				// Get all binary requirements
				const requirements = Object.values(createBinaryRequirements());
				
				// Determine which binaries to install
				let targetBinaries: string[];
				if (binaries.length > 0) {
					// Install specific binaries
					targetBinaries = binaries;
				} else {
					// Find missing binaries
					const missing = binaryManager.getMissingRequirements(requirements);
					targetBinaries = missing.map(req => req.binary);
					
					if (required_only) {
						const requiredBinaries = requirements
							.filter(req => req.required)
							.map(req => req.binary);
						targetBinaries = targetBinaries.filter(binary => requiredBinaries.includes(binary));
					}
				}
				
				if (targetBinaries.length === 0) {
					return {
						success: true,
						message: "All tools are already installed!",
						installed: [],
						failed: [],
						skipped: []
					};
				}
				
				// Force reinstall if requested
				if (force) {
					for (const binary of targetBinaries) {
						binaryManager.setBinaryOverride(binary, false);
					}
				}
				
				context.ui.notify(
					`pi-sherlock: Starting installation of ${targetBinaries.length} tools...`,
					"info"
				);
				
				// Trigger installation
				const results = await binaryManager.installBinaries(targetBinaries, context);
				
				// Categorize results
				const installed = results.filter(r => r.success).map(r => r.binary);
				const failed = results.filter(r => !r.success && r.userConsented).map(r => ({
					binary: r.binary,
					error: r.error || 'Unknown error'
				}));
				const skipped = results.filter(r => !r.userConsented).map(r => r.binary);
				
				// Calculate total time
				const totalTime = results
					.filter(r => r.installTime)
					.reduce((sum, r) => sum + (r.installTime || 0), 0);
				
				// Generate summary
				let summary = `Installation completed in ${Math.round(totalTime / 1000)}s:\n`;
				
				if (installed.length > 0) {
					summary += `✅ Installed (${installed.length}): ${installed.join(', ')}\n`;
				}
				
				if (failed.length > 0) {
					summary += `❌ Failed (${failed.length}): ${failed.map(f => `${f.binary} (${f.error})`).join(', ')}\n`;
				}
				
				if (skipped.length > 0) {
					summary += `⏭️ Skipped (${skipped.length}): ${skipped.join(', ')}\n`;
				}
				
				// Get final statistics
				const stats = binaryManager.getStats(requirements);
				summary += `\nOverall: ${stats.available}/${stats.total} tools available (${stats.required} required, ${stats.optional} optional)`;
				
				const notificationType = failed.length > 0 ? 'warning' : 'info';
				context.ui.notify(summary, notificationType);
				
				return {
					success: failed.length === 0,
					message: summary,
					installed,
					failed,
					skipped,
					stats: {
						totalAttempted: results.length,
						successful: installed.length,
						failed: failed.length,
						skipped: skipped.length,
						totalTime: Math.round(totalTime / 1000)
					}
				};
				
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				context.ui.notify(
					`pi-sherlock: Installation failed: ${errorMessage}`,
					"error"
				);
				
				return {
					success: false,
					error: errorMessage,
					installed: [],
					failed: [],
					skipped: []
				};
			}
		}
	);
}