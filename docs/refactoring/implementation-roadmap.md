# Pi-Sherlock Refactoring Implementation Roadmap

**Based on:** Architecture Refactoring Plan (2026-05-09)  
**Timeline:** 5 weeks  
**Approach:** Incremental with backward compatibility  

---

## Week 1: Tool Registry Foundation

### Day 1-2: Core Registry Infrastructure

**Task 1.1: Create Tool Registry System**
```bash
# Files to create
src/core/tool-registry.ts
src/core/tool-descriptor.ts  
src/core/binary-manager.ts
tests/core/tool-registry.test.ts
```

**Acceptance Criteria:**
- [ ] `ToolRegistry` class with `register()` and `loadAndRegisterAll()`
- [ ] `BinaryManager` for checking dependencies
- [ ] 100% test coverage for registry logic
- [ ] Type-safe tool descriptor interface

**Task 1.2: Migrate 3 Sample Tools**
```bash
# Convert these tools to use registry
src/tools/search.ts         # Simple tool (baseline)
src/tools/ripgrep.ts        # Tool with binary dependency
src/tools/read-enhanced.ts  # Enhanced tool with complex schema
```

**Acceptance Criteria:**
- [ ] Tools work identically to before
- [ ] Binary warnings auto-generated from descriptors
- [ ] Registry integration tests pass
- [ ] Documentation updated

### Day 3-5: Complete Tool Migration

**Task 1.3: Migrate All Remaining Tools**
- Convert all 14 tools to registry pattern
- Update `plugin.ts` to use registry
- Remove manual registration code

**Task 1.4: Registry Enhancement**
- Add tool categorization (search, file-ops, enhanced)
- Support for tool dependencies and conflicts
- Performance metrics collection

---

## Week 2: Unified Type System

### Day 1-3: File Type Registry

**Task 2.1: Create File Type System**
```bash
# Files to create  
src/core/file-types.ts
src/core/extension-registry.ts
tests/core/file-types.test.ts
```

**Migration Plan:**
```typescript
// Before (read-router.ts)
const CODE_EXTENSIONS: Record<string, CodeLanguage> = {
  '.ts': 'typescript',
  '.js': 'javascript',
  // ...
};

// After (using registry)
const codeExtensions = FileTypeRegistry.getCodeExtensions();
```

**Task 2.2: Refactor File Type Detection**
- Update `src/read-router.ts` to use centralized registry
- Update `src/broot-topology.ts` categorization
- Ensure AST-grep language mapping is consistent

### Day 4-5: Command Executor Framework

**Task 2.3: Subprocess Abstraction**
```bash
# Files to create
src/core/command-executor.ts
src/core/executors/sync-executor.ts  
src/core/executors/async-executor.ts
src/core/executors/bun-executor.ts
tests/core/command-executor.test.ts
```

**Task 2.4: Migrate Critical Tools**
- Update `ripgrep.ts` to use command executor
- Update `nushell-json.ts` backend selection
- Add consistent AbortSignal support

---

## Week 3: Module Decomposition

### Day 1-2: Broot Module Split

**Before:**
```
src/broot-topology.ts (707 lines)
```

**After:**
```
src/broot/
├── index.ts                 # Main exports
├── broot-parser.ts          # ~150 lines - Parse broot output  
├── native-walker.ts         # ~200 lines - Filesystem walking
├── topology-builder.ts      # ~150 lines - Tree assembly
├── git-metadata.ts          # ~100 lines - Git integration
└── broot-topology-mapper.ts # ~100 lines - Main orchestrator
```

**Acceptance Criteria:**
- [ ] Each module has single clear responsibility
- [ ] Full backward compatibility maintained
- [ ] Test coverage preserved/improved
- [ ] Performance unchanged

### Day 3-5: AST Editor Decomposition

**Before:**
```
src/ast-editor.ts (609 lines)
```

**After:**
```
src/ast-editor/
├── index.ts                 # Main exports
├── pattern-builder.ts       # ~100 lines - Pattern construction
├── ast-grep-client.ts       # ~200 lines - Subprocess management  
├── syntax-validator.ts      # ~100 lines - Syntax checking
├── backup-manager.ts        # ~100 lines - Backup/restore
└── ast-file-editor.ts       # ~100 lines - Main orchestrator
```

---

## Week 4: Advanced Decomposition

### Day 1-3: Nushell Module Split

**Before:**
```
src/nushell-json.ts (546 lines)
```

**After:**
```
src/shell/
├── index.ts                    # Main exports
├── pipeline-enhancer.ts        # ~100 lines - JSON injection
├── backends/
│   ├── base-backend.ts         # ~50 lines - Abstract base
│   ├── nushell-backend.ts      # ~150 lines - Nu implementation
│   ├── bun-backend.ts          # ~100 lines - Bun.$ wrapper
│   └── bash-backend.ts         # ~100 lines - POSIX fallback
└── nushell-json-executor.ts    # ~100 lines - Main orchestrator
```

### Day 4-5: Schema Organization

**Before:**
```
src/schemas.ts (484 lines)
```

**After:**  
```
src/schemas/
├── index.ts                 # Re-exports all schemas
├── shared-fragments.ts      # ~100 lines - Common pieces
├── search-schemas.ts        # ~100 lines - Search tools
├── file-schemas.ts          # ~100 lines - File operations  
├── shell-schemas.ts         # ~100 lines - Shell execution
└── enhanced-schemas.ts      # ~100 lines - Enhanced tools
```

---

## Week 5: Quality & Polish

### Day 1-2: Error Handling

**Task 5.1: Typed Error Hierarchy**
```bash
# Files to create
src/core/errors/index.ts
src/core/errors/base-errors.ts
src/core/errors/tool-errors.ts  
src/core/errors/command-errors.ts
tests/core/errors/error-handling.test.ts
```

**Task 5.2: Remove `as any` Usage**
- Audit all `as any` casts in codebase
- Replace with proper type narrowing
- Add schema validation where needed

### Day 3-4: Testing Standardization

**Task 5.3: Test Infrastructure**
```bash
# Files to create
src/testing/
├── doubles/
│   ├── mock-command-executor.ts
│   ├── mock-file-system.ts
│   └── mock-extension-api.ts
├── fixtures/
│   ├── sample-files/
│   └── expected-outputs/
└── utilities.ts
```

**Task 5.4: Test Migration**
- Convert integration tests to use mocks where appropriate
- Standardize test naming and organization
- Add missing edge case coverage

### Day 5: Performance & Documentation

**Task 5.5: Performance Framework**
```bash
# Files to create  
src/core/performance/
├── metrics-tracker.ts
├── performance-decorators.ts
└── benchmark-utilities.ts
```

**Task 5.6: Documentation Update**
- Update README with new architecture
- Create developer guide for adding tools
- Document testing patterns and conventions

---

## Validation Strategy

### Continuous Integration
```yaml
# .github/workflows/refactor-validation.yml
name: Refactoring Validation
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      
  integration:
    runs-on: ubuntu-latest  
    steps:
      - name: Install binaries
        run: |
          sudo apt-get install ripgrep fd-find
          npm install -g @ast-grep/cli
      - run: bun test --integration
      
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - run: bun run benchmark
      - name: Compare performance
        run: |
          # Compare with baseline metrics
          # Fail if >10% regression
```

### Quality Gates

**After Each Week:**
- [ ] All existing tests pass
- [ ] No performance regression >5%  
- [ ] Code coverage maintained at 90%+
- [ ] No new linting errors
- [ ] Documentation updated

**Before Merge:**
- [ ] Full integration test suite passes
- [ ] Manual testing of all 14 tools
- [ ] Performance benchmark comparison
- [ ] Code review by team lead
- [ ] Architecture documentation complete

---

## Risk Mitigation Checklist

### Technical Risks

**File Size Explosion:**
- [ ] Monitor total file count and size
- [ ] Use barrel exports to maintain clean public APIs
- [ ] Ensure tree-shaking still works correctly

**Performance Degradation:**
- [ ] Benchmark tool execution times before/after
- [ ] Profile memory usage with large files
- [ ] Test with real-world usage patterns

**Breaking Changes:**
- [ ] Maintain exact same public tool interfaces
- [ ] Version all internal APIs carefully
- [ ] Use feature flags for gradual rollout

### Process Risks

**Schedule Pressure:**
- [ ] Prioritize Phase 1 completion over later phases
- [ ] Have rollback plan for each week's changes
- [ ] Regular check-ins with stakeholders

**Integration Issues:**
- [ ] Test against pi-coding-agent integration daily
- [ ] Maintain compatibility with existing configs
- [ ] Document any migration steps needed

---

## Success Criteria

### Quantitative Metrics

**Code Quality:**
- File count: 45 → 65 files (controlled growth)
- Average file size: 180 → 120 lines (33% reduction)
- Cyclomatic complexity: <15 per module
- Duplicate code: <5% (from current ~15%)

**Architecture:**  
- Tool registration time: 30min → 5min (83% reduction)
- Inter-module coupling: Reduce by 50%
- Test execution time: Maintain <10s total
- Binary mocking coverage: 100%

### Qualitative Metrics

**Developer Experience:**
- New tool development guide available
- Consistent patterns across all tools  
- Clear error messages and debugging info
- Easy local testing without system dependencies

**Maintainability:**
- Single responsibility per module
- Clear interfaces and abstractions
- Comprehensive test coverage
- Updated documentation

---

## Rollback Plans

### Week-Level Rollback
Each week's changes are in a separate branch with the ability to rollback:
- `refactor/week-1-registry`
- `refactor/week-2-types`  
- `refactor/week-3-decomp1`
- `refactor/week-4-decomp2`
- `refactor/week-5-polish`

### Feature-Level Rollback
Each major component has feature flags:
```typescript
const FEATURE_FLAGS = {
  USE_TOOL_REGISTRY: true,
  USE_COMMAND_EXECUTOR: true,  
  USE_SPLIT_MODULES: true,
};
```

### Emergency Rollback
Complete rollback to pre-refactor state:
- Tagged release before starting: `v1.0-pre-refactor`
- Migration scripts to restore old structure
- Compatibility shim layer if needed

---

## Communication Plan

### Weekly Updates
- Progress report to stakeholders
- Metrics dashboard update
- Risk assessment and mitigation status
- Next week planning and dependencies

### Documentation  
- Architecture decision records (ADRs) for major changes
- Migration guide for external integrators
- Performance impact analysis
- Testing strategy documentation

### Training
- Developer onboarding session after completion
- Tool development workshop  
- Best practices sharing session
- Lessons learned retrospective

This roadmap ensures systematic, low-risk transformation of pi-sherlock into a clean, maintainable, and extensible architecture following SOLID principles.