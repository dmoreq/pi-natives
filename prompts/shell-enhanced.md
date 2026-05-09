# shell_enhanced — Enhanced Shell

Structured execution for agent workflows—primary path prefers **Nushell** pipelines that terminate with **`| to json`**, yielding JSON agents can ingest without brittle free-text framing.

When Nushell is unavailable, or emits non-structured output despite JSON intent, execution chains through POSIX: **`Bun.$`** ( **`import { $ } from "bun"`**, the spec’s `Bun.$`) as a **`sh -c`** / **`cmd`** wrapper when `fallbackToBun:true`, then **`bash`/`sh`** if the Bun-shell attempt exits non‑zero.

## Typical uses

| Need | Typical command argument |
| --- | --- |
| Directory summaries | `ls -la`, `pwd` |
| Process inventory | `ps aux` trimmed by agent |
| Environment snapshot | `env` |
| Git history blobs | `git log -n 20`, `git status` |

## Behaviour highlights

1. **`enforceJson` ON (default)** – Recognised commands get curated Nushell transforms so stdout is serialized JSON wherever possible (`ls → select … \| to json`, `$env \| to json`, `git …` parses, …).
2. **Parsing recovery** – If JSON deserialization fails but Nushell printed a bordered table, a lightweight heuristic converts rows into dictionaries before falling through.
3. **Fallback tiers** – Nushell first → POSIX via **`Bun.$`** (**`sh -c`**) when `fallbackToBun:true` (only reused when the Bun attempt succeeds with exit `0`; otherwise **`bash`/`sh`**) → direct **`bash`/`sh`** when `fallbackToBun:false` or Bun tier aborted.
4. **Cancellation & timers** – `AbortSignal`s from the host merge with **`timeout`** via `AbortSignal.any` on **Nushell / bash** `Bun.spawn` paths (**`124`**‑style timeouts vs **`125`**‑style cooperative cancel). **`Bun.$`** races **`signal.abort`** against the shell Promise (**`125`**) rather than injecting a Bun kill-hook; Prefer Nu/bash timeouts when you need a hard subprocess stop.
5. **Performance metadata** – `startupMs` (spawn/handshake overhead) vs `execMs` (streaming + wait) surfaced in plaintext output for diagnosing slow CLIs.

## vs builtin Shell / bash tool

Prefer **`shell_enhanced`** whenever you anticipate **tabular / record shaped** results you want reproducibly machine-readable (even if imperfect). Prefer the builtin free-form shell when interacting with richly interactive TUIs or completely bespoke commands absent from enhancement heuristics.
