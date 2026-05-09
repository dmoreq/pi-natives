# Auto-Installation System

The pi-sherlock extension includes an intelligent auto-installation system that can automatically install missing binary dependencies with user consent. This reduces setup friction and improves the user experience.

## Features

### Automatic Detection and Installation
- **Session Start**: Automatically detects missing tools on extension load
- **User Consent**: Requests permission before installing anything
- **Platform Awareness**: Uses appropriate package managers for each platform
- **Selective Installation**: Installs required tools by default, optional tools on request

### Supported Package Managers
- **macOS**: Homebrew (`brew`)
- **Linux**: APT (`apt`), Pacman (`pacman`)
- **Windows**: Winget (`winget`), Scoop (`scoop`)
- **Cross-platform**: NPM (`npm`), Pip (`pip`), Cargo (`cargo`)

### Installation Verification
- **Post-install Checks**: Verifies successful installation
- **Binary Detection**: Confirms tools are available in PATH
- **Error Handling**: Graceful fallback to manual installation instructions

## Configuration

### Auto-Installer Options

```typescript
interface AutoInstallerOptions {
  requireUserConsent: boolean;     // Ask before installing (default: true)
  installRequired: boolean;        // Auto-install required tools (default: true)
  installOptional: boolean;        // Auto-install optional tools (default: false)
  maxRetries: number;              // Installation retry attempts (default: 3)
  installTimeout: number;          // Command timeout in ms (default: 300000)
  verifyInstallation: boolean;     // Verify after install (default: true)
}
```

### Binary Manager Configuration

```typescript
const binaryManager = new BinaryManager({
  notifications: {
    showNotifications: true,
    notificationType: 'warning'
  },
  enableAutoInstall: true,
  autoInstaller: {
    requireUserConsent: true,
    installRequired: true,
    installOptional: false,
    maxRetries: 3,
    installTimeout: 300000,
    verifyInstallation: true
  }
});
```

## Supported Tools

### Required Tools (Auto-installed by default)
- **ripgrep** (`rg`) - Fast text search
- **fd** (`fd`) - Fast file finding  
- **fzf** (`fzf`) - Fuzzy finder
- **semgrep** (`semgrep`) - Static analysis

### Optional Tools (Manual or on-demand)
- **ast-grep** (`ast-grep`) - AST-based search and refactoring
- **tokei** (`tokei`) - Line counting by language
- **jscpd** (`jscpd`) - Duplicate code detection
- **jq** (`jq`) - JSON processing
- **yq** (`yq`) - YAML processing
- **bat** (`bat`) - Enhanced file viewing
- **Nushell** (`nu`) - Structured shell
- **broot** (`br`/`broot`) - Tree navigation

## Manual Installation Command

Users can manually trigger installation using the `install_tools` command:

### Install Missing Required Tools
```json
{
  "required_only": true
}
```

### Install Specific Tools
```json
{
  "binaries": ["ripgrep", "semgrep", "fzf"]
}
```

### Force Reinstall
```json
{
  "binaries": ["ast-grep"],
  "force": true
}
```

## Installation Methods by Platform

### macOS (Homebrew)
```bash
brew install ripgrep fd fzf semgrep ast-grep tokei jq yq bat nushell broot
```

### Ubuntu/Debian (APT)
```bash
sudo apt update
sudo apt install ripgrep fd-find fzf jq yq bat
pip install semgrep
npm install -g @ast-grep/cli jscpd
```

### Windows (Winget)
```powershell
winget install BurntSushi.ripgrep.GNU
winget install sharkdp.fd
winget install junegunn.fzf
winget install jqlang.jq
winget install MikeFarah.yq
winget install sharkdp.bat
winget install Nushell.Nushell
```

## Error Handling

### Installation Failures
- Shows clear error messages with manual installation instructions
- Logs detailed error information for debugging
- Continues operation with available tools
- Provides fallback suggestions

### Platform Compatibility
- Automatically detects available package managers
- Falls back to manual instructions if no compatible method found
- Handles platform-specific binary names and installation procedures

### User Declined Installation
- Respects user choice to decline installation
- Shows manual installation instructions as fallback
- Doesn't repeatedly prompt for the same tools

## Security Considerations

### User Consent
- Always requests explicit permission before installing
- Shows exact commands that will be executed
- Allows users to opt out of auto-installation

### Package Manager Safety
- Only uses well-known, trusted package managers
- Verifies package manager availability before use
- Uses official package names and repositories

### Installation Verification
- Confirms successful installation before marking as complete
- Verifies binary availability and basic functionality
- Reports installation failures clearly

## Implementation Details

### Architecture
- **AutoInstaller**: Core installation logic with platform detection
- **BinaryManager**: Integration with existing binary checking system
- **Installation Configs**: Declarative specifications for each tool
- **Platform Methods**: Multiple installation strategies per tool

### Integration Points
- **Session Start**: Automatic detection and installation
- **Tool Registration**: Binary availability checking
- **Smart Routing**: Binary-dependent tool routing decisions
- **Manual Commands**: User-triggered installation tools

## Future Enhancements

### Planned Features
- **Version Management**: Install specific tool versions
- **Update Detection**: Notify about available updates
- **Batch Operations**: Install multiple tools simultaneously
- **Installation Profiles**: Predefined tool sets for different use cases

### Platform Support
- **Additional Package Managers**: Nix, Chocolatey, Snap packages
- **Container Support**: Installation in Docker/Podman environments
- **CI/CD Integration**: Non-interactive installation for automation

## Troubleshooting

### Common Issues
1. **Permission Denied**: Run with appropriate privileges or use user-space package managers
2. **Network Issues**: Check internet connectivity and package repository access
3. **Platform Detection**: Manually specify installation method if auto-detection fails
4. **Version Conflicts**: Use force reinstall to resolve version mismatches

### Debug Information
- Installation logs include timing, commands executed, and error details
- Binary manager statistics show availability and installation success rates
- Detailed error messages help diagnose platform-specific issues