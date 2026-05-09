# Install Tools

Automatically install missing pi-sherlock tool dependencies.

## Usage

**Primary**: Install missing required dependencies automatically
- Use when: User mentions missing tools, installation errors, or wants to set up pi-sherlock
- Triggers: "install tools", "setup dependencies", "missing binary", "tool not found"
- Always check what's missing first, then install required tools

## Parameters

- `binaries` (optional): Specific tools to install (e.g., ["rg", "fzf", "semgrep"])
- `required_only` (optional): Only install required tools, skip optional ones (default: false)  
- `force` (optional): Force reinstall even if binary exists (default: false)

## Examples

**Install all missing required tools:**
```json
{
  "required_only": true
}
```

**Install specific tools:**
```json  
{
  "binaries": ["ripgrep", "semgrep", "fzf"]
}
```

**Force reinstall all tools:**
```json
{
  "force": true
}
```

## CRITICAL Rules

- Always show installation progress and results to user
- Handle platform-specific installation methods automatically
- Verify installation success before marking as complete
- Required tools: rg, semgrep, fzf, fd (essential for core functionality)
- Optional tools: ast-grep, tokei, jscpd, jq, yq, bat, nu, broot (enhanced features)

## Avoid When

- User just wants to check what tools are available (use binary manager instead)
- System doesn't have package managers (Windows without winget, Linux without apt/yum)
- User explicitly declined installation in the past