---
name: pi-sherlock-read-enhanced
description: Structure-aware file reading — routes through ast-grep (code skeleton), jq/yq (data slicing), or bat (highlighted text) for token-efficient context
---

# pi-sherlock-read-enhanced: Smart File Reading

**Trigger:** You need to read a LARGE file and only care about structure, not every line. Or you need to slice a JSON/YAML file without dumping it whole.

## Tool Selection

```
Large file, need structure?         → read_enhanced  ← YOU ARE HERE
Large JSON/YAML, need one field?    → read_enhanced  (jqQuery / yqQuery)
Small file, need exact full content?→ builtin read
Search inside a file?               → search
```

## Routing Logic (internal)

`read_enhanced` automatically picks the best reader:

```
File type?
  ├── Source code (.ts/.py/.rs/…) + ast-grep available
  │     → ast-grep skeleton (signatures, class outlines — no bodies)
  ├── JSON + jq available
  │     → jq expression evaluation
  ├── YAML / TOML / XML / CSV + yq available
  │     → yq expression evaluation
  ├── Any text + bat available
  │     → syntax-highlighted excerpt with smart truncation
  └── Fallback
        → native file read with line/char truncation
```

## Parameters

| Parameter | Effect | When to use |
|-----------|--------|-------------|
| `path` | File to read (required) | Always |
| `jqQuery` | jq expression for JSON files | `.dependencies`, `.scripts.build`, `.. \| .name?` |
| `yqQuery` | yq expression for YAML/TOML/XML/CSV | `.spec.replicas`, `.tool.poetry`, `.[0]` |
| `maxLines` | Override line truncation (default: 200) | When you need more |
| `maxChars` | Override char truncation (default: 10 000) | When you need more |

## Output Header

Every result begins with metadata:
```
method: ast-grep-skeleton | jq | yq | bat | native-read
fileType: typescript | json | yaml | …
size: 14823 bytes
readTimeMs: 12
estimatedTokens: 742
fallbacks: [jq-unavailable, native-read]   ← only shown when fallback occurred
```

## Usage Patterns

```
# Read a large TypeScript file — get signatures only
path: "src/auth/service.ts"
# → returns class/function/type signatures without body implementations

# Slice package.json for just dependencies
path: "package.json"  jqQuery: ".dependencies"

# Read Kubernetes manifest — just the container spec
path: "k8s/deployment.yaml"  yqQuery: ".spec.template.spec.containers"

# Read a large markdown file with bat highlighting
path: "docs/ARCHITECTURE.md"

# CSV — get first row (headers)
path: "data/export.csv"  yqQuery: ".[0]"
```

## Binary Fallback Chain

| Binary | Role | Fallback |
|--------|------|----------|
| `ast-grep` / `sg` | Code skeleton | Native full read |
| `jq` | JSON slicing | Native JSON format |
| `yq` | YAML/TOML/XML/CSV | Line excerpts |
| `bat` | Highlighted prose | Plain text truncation |

The `fallbacks` field in the output header lists what was unavailable.

## Guidelines

1. **Prefer `read_enhanced` over builtin `read` for files > ~100 lines.**
2. Always use `jqQuery` / `yqQuery` for structured data — never dump a whole 500-line YAML.
3. The ast-grep skeleton is read-only — it shows structure, not the full implementation.
4. If you need exact content to make an edit, use `read_enhanced` first to understand structure, then builtin `read` on a specific section.
5. Pair with `find_files` → narrow files → `read_enhanced` for efficient exploration.
6. `estimatedTokens` in the header helps budget context window usage.

## Do NOT use for

- Small files where full content is needed → builtin `read`
- Searching content → `search` or `concept_search`
- Finding files → `find_files` or `fuzzy_find`
- Writing files → `write_enhanced` or builtin `write`
