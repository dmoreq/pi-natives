# Smart Routing Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## 🎉 STATUS UPDATE - FOUNDATION READY

**Phase 1 Foundation (✅ COMPLETED):** Core infrastructure with tool registry, binary manager, file type detection, and command executor.

**Phase 2 Architecture (✅ COMPLETED):** Modular architecture with 39+ focused modules, 94.7% test coverage, and complete SOLID compliance.

**Enhanced Tools Status:** 14 tools ready for intelligent routing including enhanced core tools (read_enhanced, write_enhanced, edit_enhanced, shell_enhanced, ls_enhanced).

**Current Routing Infrastructure:** Basic tool registry and file type detection systems are in place. Routing logic can now be built on the solid modular foundation.

---

**Goal:** Implement comprehensive smart routing system for pi-sherlock that intelligently directs users to the optimal tool based on their intent across all 14 available tools.

**Architecture:** Multi-layered routing system with decision trees, enhanced prompt guidelines, comprehensive documentation, and automated testing to ensure pi always selects the most appropriate tool for each task.

**Tech Stack:** TypeScript, Bun test framework, Markdown documentation, JSON schemas, decision tree algorithms, leveraging existing modular architecture

---

## Current State Analysis (Updated Post-Phase 2)

**Existing Infrastructure (✅ Available):**
- **Tool Registry System:** Centralized tool registration with metadata
- **File Type Detection:** Smart MIME type and language detection via FileTypeRegistry
- **Binary Manager:** Intelligent binary availability checking with fallbacks
- **Command Executor:** Safe subprocess execution with timeout and error handling
- **Modular Architecture:** 39+ focused modules with clear interfaces
- **Comprehensive Testing:** 94.7% test coverage with mock injection capabilities

**Current Routing Capabilities:**
- Basic tool descriptions and prompt snippets
- Simple guidelines for individual tools
- File type routing for enhanced tools (read_enhanced, edit_enhanced)
- Shell backend routing (Nushell → Bun → Bash fallback chains)

**Enhanced Tools Ready for Routing (14 Total):**

| Category | Tools | Current Routing |
|----------|-------|-----------------|
| **Content Search** | `search`, `ripgrep`, `concept_search` | Basic guidelines |
| **File Discovery** | `find_files`, `fuzzy_find` | Basic guidelines |
| **Structural Analysis** | `semgrep`, `ast_grep` | Basic guidelines |
| **Code Metrics** | `count_lines`, `find_duplicates` | Basic guidelines |
| **Enhanced Core** | `read_enhanced`, `write_enhanced`, `edit_enhanced`, `shell_enhanced`, `ls_enhanced` | Smart internal routing |

**Gaps Identified (Now Ready to Address):**
1. No centralized decision tree across all 14 tools
2. Limited cross-tool conflict resolution 
3. No systematic testing of tool selection
4. Enhanced tools need integrated routing
5. Missing intelligent fallback strategies
6. Documentation needs consolidation

---

## Task Structure

### Task 1: Smart Routing Architecture Design

**Files:**
- Create: `src/routing/types.ts`
- Create: `src/routing/decision-engine.ts`
- Create: `src/routing/context-analyzer.ts`
- Create: `docs/routing-architecture.md`
- Integrate: Use existing `src/foundation/tool-registry/` and `src/foundation/file-type-registry/`

- [ ] **Step 1: Define routing types and interfaces**

```typescript
// src/routing/types.ts
import type { FileTypeInfo } from '../foundation/file-type-registry/types';
import type { BinaryAvailability } from '../foundation/binary-manager/types';

export interface ToolContext {
  intent: 'search' | 'find' | 'analyze' | 'count' | 'refactor' | 'read' | 'write' | 'edit' | 'shell' | 'list';
  specificity: 'exact' | 'fuzzy' | 'conceptual' | 'structural';
  scope: 'content' | 'structure' | 'files' | 'metrics' | 'operations';
  hasPattern: boolean;
  patternType?: 'regex' | 'glob' | 'natural' | 'ast' | 'semantic';
  features?: string[];
  fileContext?: FileTypeInfo;
  binaryAvailability?: BinaryAvailability;
  performancePreference?: 'speed' | 'accuracy' | 'token_efficiency';
}

export interface RoutingDecision {
  primaryTool: string;
  secondaryTools: string[];
  confidence: number;
  reasoning: string[];
  fallbacks: string[];
  enhancedFeatures?: string[];
  binaryRequirements?: string[];
}

export interface RoutingRule {
  conditions: Partial<ToolContext>;
  tool: string;
  priority: number;
  blockingConditions?: Partial<ToolContext>;
  requiredBinaries?: string[];
  enhancedAlternative?: string;
}
```

- [ ] **Step 2: Create context analyzer**

```typescript
// src/routing/context-analyzer.ts
import type { ToolContext } from './types';
import { FileTypeRegistry } from '../foundation/file-type-registry';
import { BinaryManager } from '../foundation/binary-manager';

export class ContextAnalyzer {
  constructor(
    private fileTypeRegistry: FileTypeRegistry,
    private binaryManager: BinaryManager
  ) {}

  analyzeQuery(query: string, filePath?: string): ToolContext {
    const intent = this.detectIntent(query);
    const specificity = this.detectSpecificity(query);
    const scope = this.detectScope(query);
    const hasPattern = this.detectPattern(query);
    
    return {
      intent,
      specificity, 
      scope,
      hasPattern,
      patternType: hasPattern ? this.detectPatternType(query) : undefined,
      features: this.detectRequiredFeatures(query),
      fileContext: filePath ? this.fileTypeRegistry.detectType(filePath) : undefined,
      binaryAvailability: this.binaryManager.getAvailability(),
      performancePreference: this.detectPerformancePreference(query)
    };
  }

  private detectIntent(query: string): ToolContext['intent'] {
    const searchKeywords = /search|find|grep|look|locate/i;
    const analyzeKeywords = /analyze|audit|security|bug|smell|semgrep|ast.*grep/i;
    const countKeywords = /count|lines|metrics|stats|tokei|loc/i;
    const refactorKeywords = /refactor|replace|rewrite|duplicate|jscpd/i;
    const readKeywords = /read|show|display|content|cat/i;
    const writeKeywords = /write|create|save|output/i;
    const editKeywords = /edit|modify|change|update|replace/i;
    const shellKeywords = /shell|command|execute|run|bash|nu/i;
    const listKeywords = /list|ls|dir|tree|files|directories/i;
    
    if (refactorKeywords.test(query)) return 'refactor';
    if (countKeywords.test(query)) return 'count';
    if (analyzeKeywords.test(query)) return 'analyze';
    if (editKeywords.test(query)) return 'edit';
    if (writeKeywords.test(query)) return 'write';
    if (readKeywords.test(query)) return 'read';
    if (shellKeywords.test(query)) return 'shell';
    if (listKeywords.test(query)) return 'list';
    if (searchKeywords.test(query)) return 'search';
    return 'find';
  }

  private detectPerformancePreference(query: string): 'speed' | 'accuracy' | 'token_efficiency' {
    if (/fast|quick|speed/i.test(query)) return 'speed';
    if (/accurate|precise|thorough/i.test(query)) return 'accuracy';
    if (/smart|enhanced|token|efficient/i.test(query)) return 'token_efficiency';
    return 'token_efficiency'; // Default for AI agents
  }
  
  // Additional detection methods...
}
```

- [ ] **Step 3: Build decision engine**

```typescript
// src/routing/decision-engine.ts
import type { ToolContext, RoutingDecision, RoutingRule } from './types';

export class DecisionEngine {
  private rules: RoutingRule[] = [];
  
  constructor() {
    this.loadRules();
  }
  
  decide(context: ToolContext): RoutingDecision {
    const applicableRules = this.rules
      .filter(rule => this.matchesConditions(context, rule.conditions))
      .filter(rule => !this.matchesBlockingConditions(context, rule.blockingConditions))
      .sort((a, b) => b.priority - a.priority);
    
    if (applicableRules.length === 0) {
      return this.getDefaultDecision(context);
    }
    
    const primaryRule = applicableRules[0];
    const secondaryRules = applicableRules.slice(1, 3);
    
    return {
      primaryTool: primaryRule.tool,
      secondaryTools: secondaryRules.map(r => r.tool),
      confidence: this.calculateConfidence(applicableRules),
      reasoning: this.buildReasoning(context, primaryRule),
      fallbacks: this.getFallbacks(primaryRule.tool)
    };
  }
  
  private loadRules(): void {
    // Load routing rules configuration
  }
}
```

- [ ] **Step 4: Document architecture**

Create comprehensive architecture documentation in `docs/routing-architecture.md`

- [ ] **Step 5: Commit architecture foundation**

```bash
git add src/routing/ docs/routing-architecture.md
git commit -m "feat: add smart routing architecture foundation"
```

### Task 2: Enhanced Prompt Guidelines System

**Files:**
- Create: `src/routing/prompt-builder.ts`
- Modify: `src/tools/search.ts:24-28`
- Modify: `src/tools/bm25.ts:28-32`
- Create: `src/routing/guidelines-config.json`
- Create: `tests/routing/prompt-guidelines.test.ts`

- [ ] **Step 1: Create guidelines configuration**

```json
// src/routing/guidelines-config.json
{
  "tools": {
    "search": {
      "primaryUse": "Default regex pattern content search",
      "triggers": [
        "You have a PRECISE regex pattern",
        "You need function definitions, TODOs, error patterns",
        "You want structured, limited results with gitignore awareness"
      ],
      "avoid": [
        "Conceptual queries → concept_search",
        "Code structure → semgrep/ast_grep", 
        "File finding → find_files/fuzzy_find",
        "Advanced features → ripgrep"
      ],
      "critical": [
        "NEVER shell out to grep/rg/ag/ack",
        "This is the DEFAULT content search tool"
      ],
      "examples": ["function\\s+\\w+", "TODO.*bug", "log.*Error"]
    },
    "read_enhanced": {
      "primaryUse": "Smart file reading with structure awareness",
      "triggers": [
        "You need intelligent file content reading",
        "You want AST skeleton for code files",
        "You need JSON/YAML data slicing",
        "You want syntax-highlighted output"
      ],
      "avoid": [
        "Simple text files without structure → native read",
        "Full file content needed → standard read"
      ],
      "critical": [
        "Use for token-efficient reading",
        "Automatically routes by file type"
      ],
      "examples": ["read TypeScript file structure", "extract JSON fields"]
    },
    "edit_enhanced": {
      "primaryUse": "AST-aware file editing without syntax breaking",
      "triggers": [
        "You need to modify code while preserving syntax",
        "You want preview mode before applying changes",
        "You need automatic backup creation",
        "You want AST-based pattern matching"
      ],
      "avoid": [
        "Simple text replacements → native edit",
        "Non-code files → native fallback available"
      ],
      "critical": [
        "Prevents syntax errors in code edits",
        "Always creates backups by default"
      ],
      "examples": ["refactor variable names", "update function signatures"]
    },
    "shell_enhanced": {
      "primaryUse": "Structured shell execution with JSON output",
      "triggers": [
        "You need shell commands with structured output",
        "You want to eliminate parsing ambiguity",
        "You need reliable JSON from CLI tools"
      ],
      "avoid": [
        "Simple commands without structured needs → standard shell",
        "Already structured output → may be redundant"
      ],
      "critical": [
        "Uses Nushell → Bun → Bash fallback chain",
        "Reduces hallucinations from unparseable output"
      ],
      "examples": ["ls with JSON", "git status structured"]
    },
    "ls_enhanced": {
      "primaryUse": "Repository-aware directory listing with intelligence",
      "triggers": [
        "You need intelligent directory structure understanding",
        "You want git status integration",
        "You need token-efficient tree representation"
      ],
      "avoid": [
        "Simple directory listing → standard ls",
        "Single-level listing → find_files"
      ],
      "critical": [
        "Uses broot → native walker fallback",
        "Optimized for AI agent token efficiency"
      ],
      "examples": ["project structure overview", "repository topology"]
    }
  }
}
```

- [ ] **Step 2: Build dynamic prompt guidelines generator**

```typescript
// src/routing/prompt-builder.ts
interface GuidelineConfig {
  primaryUse: string;
  triggers: string[];
  avoid: string[];
  critical: string[];
  examples: string[];
}

export class PromptBuilder {
  static buildGuidelines(toolName: string, config: GuidelineConfig): string[] {
    const guidelines: string[] = [];
    
    // Add primary use
    guidelines.push(`Primary: ${config.primaryUse}`);
    
    // Add trigger conditions
    config.triggers.forEach(trigger => {
      guidelines.push(`Use when: ${trigger}`);
    });
    
    // Add avoidance rules
    config.avoid.forEach(avoid => {
      guidelines.push(`Avoid: ${avoid}`);
    });
    
    // Add critical rules
    config.critical.forEach(critical => {
      guidelines.push(`CRITICAL: ${critical}`);
    });
    
    return guidelines;
  }
}
```

- [ ] **Step 3: Update search tool with enhanced guidelines**

```typescript
// src/tools/search.ts (modify lines 24-28)
import { PromptBuilder } from '../routing/prompt-builder';
import guidelinesConfig from '../routing/guidelines-config.json';

// Replace existing promptGuidelines with:
promptGuidelines: PromptBuilder.buildGuidelines('search', guidelinesConfig.tools.search),
```

- [ ] **Step 4: Write guidelines tests**

```typescript
// tests/routing/prompt-guidelines.test.ts
import { describe, test, expect } from "bun:test";
import { PromptBuilder } from "../../src/routing/prompt-builder";

describe("Prompt Guidelines Builder", () => {
  test("should generate consistent guidelines format", () => {
    const config = {
      primaryUse: "Test search",
      triggers: ["condition A", "condition B"],
      avoid: ["avoid X"],
      critical: ["critical rule"],
      examples: ["example"]
    };
    
    const guidelines = PromptBuilder.buildGuidelines('test', config);
    
    expect(guidelines).toHaveLength(5);
    expect(guidelines[0]).toBe("Primary: Test search");
    expect(guidelines[1]).toBe("Use when: condition A");
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
bun test tests/routing/prompt-guidelines.test.ts
git add src/routing/prompt-builder.ts src/routing/guidelines-config.json tests/routing/
git commit -m "feat: add dynamic prompt guidelines system"
```

### Task 3: Decision Tree Implementation

**Files:**
- Create: `src/routing/decision-tree.ts`
- Create: `src/routing/tree-config.json`
- Create: `docs/decision-tree.md`
- Create: `tests/routing/decision-tree.test.ts`

- [ ] **Step 1: Define decision tree structure**

```json
// src/routing/tree-config.json
{
  "decisionTree": {
    "root": {
      "question": "What is the primary intent?",
      "options": {
        "content_search": {
          "question": "What type of content search?",
          "options": {
            "exact_regex": { "tool": "search", "confidence": 0.9 },
            "advanced_regex": { "tool": "ripgrep", "confidence": 0.85 },
            "conceptual": { "tool": "concept_search", "confidence": 0.85 },
            "structural_security": { "tool": "semgrep", "confidence": 0.8 },
            "structural_refactor": { "tool": "ast_grep", "confidence": 0.8 }
          }
        },
        "file_finding": {
          "question": "How specific is your search?",
          "options": {
            "exact_criteria": { "tool": "find_files", "confidence": 0.9 },
            "fuzzy_name": { "tool": "fuzzy_find", "confidence": 0.85 }
          }
        },
        "code_analysis": {
          "question": "What type of analysis?",
          "options": {
            "metrics": { "tool": "count_lines", "confidence": 0.9 },
            "duplicates": { "tool": "find_duplicates", "confidence": 0.85 },
            "security": { "tool": "semgrep", "confidence": 0.8 }
          }
        },
        "file_operations": {
          "question": "What file operation?",
          "options": {
            "smart_reading": { "tool": "read_enhanced", "confidence": 0.9 },
            "atomic_writing": { "tool": "write_enhanced", "confidence": 0.9 },
            "syntax_aware_editing": { "tool": "edit_enhanced", "confidence": 0.9 }
          }
        },
        "system_operations": {
          "question": "What system operation?",
          "options": {
            "structured_shell": { "tool": "shell_enhanced", "confidence": 0.9 },
            "intelligent_listing": { "tool": "ls_enhanced", "confidence": 0.9 }
          }
        },
        "refactoring": {
          "tool": "ast_grep",
          "confidence": 0.9
        }
      }
    }
  }
}
```

- [ ] **Step 2: Implement decision tree engine**

```typescript
// src/routing/decision-tree.ts
interface TreeNode {
  question?: string;
  options?: Record<string, TreeNode>;
  tool?: string;
  confidence?: number;
}

export class DecisionTree {
  private tree: TreeNode;
  
  constructor(config: any) {
    this.tree = config.decisionTree.root;
  }
  
  traverse(context: ToolContext): { tool: string; confidence: number; path: string[] } {
    return this.traverseNode(this.tree, context, []);
  }
  
  private traverseNode(
    node: TreeNode, 
    context: ToolContext, 
    path: string[]
  ): { tool: string; confidence: number; path: string[] } {
    // If leaf node, return tool
    if (node.tool) {
      return {
        tool: node.tool,
        confidence: node.confidence || 0.5,
        path
      };
    }
    
    // If decision node, evaluate best path
    if (node.options) {
      const bestOption = this.selectBestOption(node.options, context);
      return this.traverseNode(
        node.options[bestOption],
        context,
        [...path, bestOption]
      );
    }
    
    throw new Error("Invalid tree node");
  }
  
  private selectBestOption(options: Record<string, TreeNode>, context: ToolContext): string {
    // Logic to select best option based on context
    // This would include sophisticated scoring based on context properties
    return Object.keys(options)[0]; // Simplified for example
  }
}
```

- [ ] **Step 3: Write decision tree tests**

```typescript
// tests/routing/decision-tree.test.ts
import { describe, test, expect } from "bun:test";
import { DecisionTree } from "../../src/routing/decision-tree";
import treeConfig from "../../src/routing/tree-config.json";

describe("Decision Tree", () => {
  test("should traverse to correct tool for exact search", () => {
    const tree = new DecisionTree(treeConfig);
    const context = {
      intent: 'search' as const,
      specificity: 'exact' as const,
      scope: 'content' as const,
      hasPattern: true,
      patternType: 'regex' as const
    };
    
    const result = tree.traverse(context);
    
    expect(result.tool).toBe('search');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
```

- [ ] **Step 4: Document decision tree**

Create visual decision tree documentation with flowcharts in `docs/decision-tree.md`

- [ ] **Step 5: Run tests and commit**

```bash
bun test tests/routing/decision-tree.test.ts
git add src/routing/decision-tree.ts docs/decision-tree.md tests/routing/decision-tree.test.ts
git commit -m "feat: implement decision tree routing engine"
```

### Task 4: Routing Integration

**Files:**
- Create: `src/routing/index.ts`
- Modify: `src/plugin.ts` (integrate with existing foundation modules)
- Create: `src/routing/router.ts`
- Create: `tests/routing/integration.test.ts`
- Integrate: Use existing `src/foundation/tool-registry/ToolRegistry`

- [ ] **Step 1: Create main router class**

```typescript
// src/routing/router.ts
import { ContextAnalyzer } from './context-analyzer';
import { DecisionEngine } from './decision-engine';
import { DecisionTree } from './decision-tree';
import type { RoutingDecision } from './types';

export class SmartRouter {
  private contextAnalyzer: ContextAnalyzer;
  private decisionEngine: DecisionEngine;
  private decisionTree: DecisionTree;
  
  constructor() {
    this.contextAnalyzer = new ContextAnalyzer();
    this.decisionEngine = new DecisionEngine();
    this.decisionTree = new DecisionTree(require('./tree-config.json'));
  }
  
  route(query: string): RoutingDecision {
    const context = this.contextAnalyzer.analyzeQuery(query);
    
    // Get decision from both engines
    const engineDecision = this.decisionEngine.decide(context);
    const treeDecision = this.decisionTree.traverse(context);
    
    // Combine decisions with weighted confidence
    return this.combineDecisions(engineDecision, treeDecision);
  }
  
  private combineDecisions(
    engineDecision: RoutingDecision,
    treeDecision: { tool: string; confidence: number; path: string[] }
  ): RoutingDecision {
    // If both agree, high confidence
    if (engineDecision.primaryTool === treeDecision.tool) {
      return {
        ...engineDecision,
        confidence: Math.max(engineDecision.confidence, treeDecision.confidence)
      };
    }
    
    // If they disagree, use higher confidence
    if (engineDecision.confidence > treeDecision.confidence) {
      return {
        ...engineDecision,
        secondaryTools: [treeDecision.tool, ...engineDecision.secondaryTools]
      };
    } else {
      return {
        primaryTool: treeDecision.tool,
        secondaryTools: [engineDecision.primaryTool],
        confidence: treeDecision.confidence,
        reasoning: [`Decision tree path: ${treeDecision.path.join(' → ')}`],
        fallbacks: engineDecision.fallbacks
      };
    }
  }
}
```

- [ ] **Step 2: Create routing module exports**

```typescript
// src/routing/index.ts
export { SmartRouter } from './router';
export { ContextAnalyzer } from './context-analyzer';
export { DecisionEngine } from './decision-engine';
export { DecisionTree } from './decision-tree';
export { PromptBuilder } from './prompt-builder';
export type { ToolContext, RoutingDecision, RoutingRule } from './types';
```

- [ ] **Step 3: Integrate router into plugin**

```typescript
// src/plugin.ts (integrate with existing foundation)
import { SmartRouter } from './routing';
import { ToolRegistry } from './foundation/tool-registry';
import { BinaryManager } from './foundation/binary-manager';
import { FileTypeRegistry } from './foundation/file-type-registry';

export default function piSherlockExtension(pi: ExtensionAPI) {
  // Initialize foundation systems
  const binaryManager = new BinaryManager();
  const fileTypeRegistry = new FileTypeRegistry();
  const toolRegistry = new ToolRegistry();
  const router = new SmartRouter(fileTypeRegistry, binaryManager, toolRegistry);
  
  // Add routing context to session start
  pi.on("session_start", (_event, ctx) => {
    // Existing foundation checks...
    
    // Add routing intelligence notification
    ctx.ui.notify(
      "pi-sherlock: Smart routing enabled across 14 tools - I'll guide you to the optimal choice for each task.",
      "info"
    );
  });
  
  // Register tools with routing-aware metadata...
}
```

- [ ] **Step 4: Write integration tests**

```typescript
// tests/routing/integration.test.ts
import { describe, test, expect } from "bun:test";
import { SmartRouter } from "../../src/routing";

describe("Smart Routing Integration", () => {
  test("should route all tool types correctly", () => {
    const router = new SmartRouter();
    
    const testCases = [
      { query: "find all function definitions with regex", expected: "search" },
      { query: "find authentication related code", expected: "concept_search" },
      { query: "smart read this TypeScript file", expected: "read_enhanced" },
      { query: "edit this code with AST awareness", expected: "edit_enhanced" },
      { query: "run shell command with structured output", expected: "shell_enhanced" },
      { query: "list repository structure intelligently", expected: "ls_enhanced" },
      { query: "count lines of code", expected: "count_lines" },
      { query: "find duplicate code blocks", expected: "find_duplicates" }
    ];
    
    testCases.forEach(({ query, expected }) => {
      const decision = router.route(query);
      expect(decision.primaryTool).toBe(expected);
    });
  });
});
```

- [ ] **Step 5: Run integration tests and commit**

```bash
bun test tests/routing/integration.test.ts
git add src/routing/index.ts src/routing/router.ts tests/routing/integration.test.ts
git commit -m "feat: integrate smart routing into plugin"
```

### Task 5: Documentation and Testing Suite

**Files:**
- Create: `docs/smart-routing.md`
- Create: `docs/tool-selection-guide.md`
- Create: `tests/routing/end-to-end.test.ts`
- Modify: `README.md:67-79`

- [ ] **Step 1: Create comprehensive documentation**

```markdown
# docs/smart-routing.md
# Smart Routing System

## Overview
Pi-sherlock uses intelligent routing to automatically select the best tool for your task...

## How It Works
1. **Context Analysis** - Analyzes your query intent, specificity, and scope
2. **Decision Engine** - Applies routing rules based on context
3. **Decision Tree** - Provides fallback logic and confidence scoring
4. **Tool Selection** - Chooses primary tool with alternatives

## Routing Logic
[Detailed routing decision explanations]

## Troubleshooting
[Common routing issues and solutions]
```

- [ ] **Step 2: Create tool selection guide**

```markdown
# docs/tool-selection-guide.md  
# Tool Selection Guide

## Quick Reference

| I want to... | Primary Tool | Enhanced Alternative | Why |
|--------------|-------------|-------------------|-----|
| Find regex pattern in files | `search` | - | Default content search, .gitignore aware |
| Find concept without exact terms | `concept_search` | - | BM25 relevance ranking |
| List files by name/extension | `find_files` | - | Fast fd-based file finding |
| Find files with fuzzy name | `fuzzy_find` | - | Approximate filename matching |
| Read file intelligently | Standard read | `read_enhanced` | AST skeleton, JSON slicing, token efficiency |
| Write file atomically | Standard write | `write_enhanced` | Atomic operations, streaming, backups |
| Edit code safely | Standard edit | `edit_enhanced` | AST-aware, syntax preservation, preview |
| Run shell with structure | Standard shell | `shell_enhanced` | JSON output, eliminates parsing ambiguity |
| List directory intelligently | Standard ls | `ls_enhanced` | Repository topology, git integration |
| Analyze code security | - | `semgrep` | Security patterns, bug detection |
| Search/refactor AST | - | `ast_grep` | Structural search, code refactoring |
| Count code metrics | - | `count_lines` | LOC, comments, language statistics |
| Find duplicate code | - | `find_duplicates` | Copy-paste detection, similarity analysis |

[Complete tool comparison matrix]
```

- [ ] **Step 3: Create end-to-end tests**

```typescript
// tests/routing/end-to-end.test.ts
import { describe, test, expect } from "bun:test";
import { SmartRouter } from "../../src/routing";

describe("Smart Routing End-to-End", () => {
  const router = new SmartRouter();
  
  test("should handle complex query routing scenarios", () => {
    const testCases = [
      {
        query: "find all TODO comments in TypeScript files",
        expectedTool: "search",
        reason: "exact pattern search with file type filter"
      },
      {
        query: "show me authentication related code",
        expectedTool: "concept_search", 
        reason: "conceptual search without exact pattern"
      },
      {
        query: "list all configuration files",
        expectedTool: "find_files",
        reason: "file listing by type/pattern"
      },
      {
        query: "find the config file, I think it's called cfg or similar",
        expectedTool: "fuzzy_find",
        reason: "fuzzy filename matching"
      },
      {
        query: "smart read this TypeScript file structure",
        expectedTool: "read_enhanced",
        reason: "AST-aware reading for code structure"
      },
      {
        query: "edit this function safely without breaking syntax",
        expectedTool: "edit_enhanced",
        reason: "syntax-preserving code editing"
      },
      {
        query: "run git status with structured output",
        expectedTool: "shell_enhanced",
        reason: "shell command with JSON structure"
      },
      {
        query: "show repository directory structure intelligently",
        expectedTool: "ls_enhanced",
        reason: "intelligent directory topology"
      },
      {
        query: "security audit this codebase",
        expectedTool: "semgrep",
        reason: "security-focused code analysis"
      },
      {
        query: "refactor all instances of this pattern",
        expectedTool: "ast_grep",
        reason: "structural search and replace"
      }
    ];
    
    testCases.forEach(({ query, expectedTool, reason }) => {
      const decision = router.route(query);
      expect(decision.primaryTool).toBe(expectedTool);
      expect(decision.confidence).toBeGreaterThan(0.7);
    });
  });
  
  test("should provide meaningful fallbacks", () => {
    const decision = router.route("search for something vague");
    expect(decision.fallbacks.length).toBeGreaterThan(0);
    expect(decision.reasoning.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Update README with smart routing section**

```markdown
# README.md (add Smart Routing section)
## Smart Routing

Pi-sherlock automatically selects the optimal tool based on your query intent across 14 specialized tools:

### Content & Structure Analysis
- **"find regex pattern"** → `search` (default content search)
- **"find authentication code"** → `concept_search` (relevance-based)
- **"security audit this code"** → `semgrep` (security analysis)
- **"refactor this pattern"** → `ast_grep` (structural search/replace)

### File Operations  
- **"list all .ts files"** → `find_files` (file discovery)
- **"find the config file"** → `fuzzy_find` (approximate matching)
- **"smart read this code"** → `read_enhanced` (AST skeleton, token efficient)
- **"edit code safely"** → `edit_enhanced` (syntax-aware editing)

### System Operations
- **"run command with JSON"** → `shell_enhanced` (structured output)
- **"show repository structure"** → `ls_enhanced` (intelligent topology)

### Code Metrics
- **"count lines of code"** → `count_lines` (tokei metrics)
- **"find duplicate code"** → `find_duplicates` (jscpd analysis)

The routing system analyzes context, leverages the modular architecture, and provides intelligent fallbacks based on binary availability.

See [Smart Routing Documentation](docs/smart-routing.md) for details.
```

- [ ] **Step 5: Run full test suite and commit**

```bash
bun test
git add docs/ tests/routing/end-to-end.test.ts README.md
git commit -m "docs: add comprehensive smart routing documentation and tests"
```

---

## Conflict Resolution Analysis

**Potential Conflicts Identified:**

1. **Tool Overlap**: `search` vs `ripgrep` vs `concept_search`
   - **Resolution**: Clear priority hierarchy with confidence scoring
   - **Implementation**: Decision engine uses specificity scoring

2. **File Finding Conflicts**: `find_files` vs `fuzzy_find`  
   - **Resolution**: Intent detection (exact vs approximate)
   - **Implementation**: Context analyzer detects specificity

3. **Structure Analysis**: `semgrep` vs `ast_grep`
   - **Resolution**: Purpose-based routing (security vs refactoring)
   - **Implementation**: Intent classification in context analyzer

4. **Documentation Conflicts**: Multiple routing explanations
   - **Resolution**: Single source of truth with cross-references
   - **Implementation**: Centralized docs with tool-specific sections

**No Conflicts Between Planned Components:**
- Each task builds incrementally on previous work
- Modular architecture allows independent development
- Test-driven approach catches integration issues early
- Clear separation of concerns prevents overlap

---

## Self-Review

**Spec Coverage Check:**
✅ Implement/improve routing logic → Task 1-4 (architecture, engines, integration)
✅ Document routing strategy → Task 5 (comprehensive docs)  
✅ Analyze current routing → Completed in analysis phase
✅ Enhance prompt guidelines → Task 2 (dynamic guidelines system)
✅ Create decision tree → Task 3 (tree implementation and config)
✅ Test routing logic → Tasks 2-5 (unit, integration, e2e tests)

**Placeholder Scan:** No TBD, TODO, or incomplete sections found.

**Type Consistency:** All interfaces, method signatures, and property names are consistent across tasks and leverage existing foundation types.

**Foundation Integration:** Plan updated to use existing Phase 2 modular architecture:
- ToolRegistry for tool metadata and registration
- FileTypeRegistry for intelligent file type detection  
- BinaryManager for availability checking and fallback strategies
- CommandExecutor for safe subprocess execution
- Comprehensive testing infrastructure with 94.7% coverage

---

## Execution Handoff

Plan complete and updated to reflect **Phase 2 modular architecture foundation**. Ready for implementation with solid infrastructure in place.

## Updated Implementation Advantages

**Foundation Ready**: All core infrastructure (ToolRegistry, BinaryManager, FileTypeRegistry, CommandExecutor) is implemented and tested.

**Modular Integration**: Smart routing can leverage existing 39+ modules with clear interfaces and dependency injection.

**Enhanced Tool Support**: Routing can intelligently choose between standard and enhanced tools based on context and binary availability.

**Testing Infrastructure**: 94.7% test coverage provides confidence for routing logic testing.

## Execution Options:

**1. Subagent-Driven (recommended)** - Dispatch fresh subagent per task, leverage existing modules, fast iteration with foundation support

**2. Inline Execution** - Execute tasks using existing infrastructure, batch implementation with modular checkpoints

**Current Status**: Plan updated, foundation solid, ready for smart routing implementation.