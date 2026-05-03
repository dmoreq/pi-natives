/**
 * pi-sherlock — high-performance file search and text operations for pi.
 *
 * Tools:
 *   search           — regex content search (ripgrep) — your DEFAULT content search
 *   concept_search   — BM25 relevance-ranked conceptual search
 *   semgrep          — AST-aware static analysis for code structure
 *   fuzzy_find       — fuzzy file PATH search for approximate filenames
 *   find_files       — fast file/directory listing by name/extension/type
 *   ripgrep          — advanced rg features: multiline, count, hidden, no-ignore
 *   ast_grep         — structural search & refactoring via AST patterns (metavariables)
 *   count_lines      — count lines of code, comments, blanks by language
 *   find_duplicates  — detect duplicated/copy-pasted code blocks
 *
 * Trigger decision flow:
 *   "I know the regex"           → search
 *   "I have a concept/idea"      → concept_search
 *   "I need security/linting audit"→ semgrep
 *   "I need structural search/refactor"→ ast_grep
 *   "I sort of know the filename"→ fuzzy_find
 *   "I know the filename/ext"    → find_files
 *   "I need multiline/hidden/..."→ ripgrep
 *   "How many lines of code?"    → count_lines
 *   "Find duplicate code blocks"  → find_duplicates
 */
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { checkBinary } from "./shared/cli";

import { registerSearchTool } from "./tools/search";
import { registerBm25Tool } from "./tools/bm25";
import { registerSemgrepTool } from "./tools/semgrep";
import { registerFzfTool } from "./tools/fzf";
import { registerFdTool } from "./tools/fd";
import { registerRipgrepTool } from "./tools/ripgrep";
import { registerAstGrepTool } from "./tools/ast-grep";
import { registerTokeiTool } from "./tools/tokei";
import { registerJscpdTool } from "./tools/jscpd";

// ── Load prompt descriptions at import time ─────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const searchDescription   = readFileSync(path.resolve(__dirname, "..", "prompts", "search.md"), "utf-8");
const semgrepDescription  = readFileSync(path.resolve(__dirname, "..", "prompts", "semgrep.md"), "utf-8");
const fzfDescription      = readFileSync(path.resolve(__dirname, "..", "prompts", "fzf.md"), "utf-8");
const fdDescription       = readFileSync(path.resolve(__dirname, "..", "prompts", "fd.md"), "utf-8");
const ripgrepDescription  = readFileSync(path.resolve(__dirname, "..", "prompts", "ripgrep.md"), "utf-8");
const astGrepDescription  = readFileSync(path.resolve(__dirname, "..", "prompts", "ast-grep.md"), "utf-8");
const tokeiDescription    = readFileSync(path.resolve(__dirname, "..", "prompts", "tokei.md"), "utf-8");
const jscpdDescription    = readFileSync(path.resolve(__dirname, "..", "prompts", "jscpd.md"), "utf-8");

// ── Extension entry point ──────────────────────────────────────────

export default function piSherlockExtension(pi: ExtensionAPI) {
	// Check binary availability on session start
	pi.on("session_start", (_event, ctx) => {
		const bins: Array<[string, string, string]> = [
			["rg", "ripgrep", "`brew install ripgrep`"],
			["semgrep", "semgrep", "`brew install semgrep` or `pip install semgrep`"],
			["fzf", "fzf", "`brew install fzf`"],
			["fd", "fd", "`brew install fd`"],
			["ast-grep", "ast-grep", "`brew install ast-grep`"],
			["tokei", "tokei", "`brew install tokei`"],
			["jscpd", "jscpd", "`npm i -g jscpd` or `brew install jscpd`"],
		];
		for (const [binary, label, installCmd] of bins) {
			if (!checkBinary(binary)) {
				ctx.ui.notify(
					`pi-sherlock: ${label} (${binary}) not found. Install via ${installCmd}.`,
					"warning",
				);
			}
		}
	});

	// Register all tools
	registerSearchTool(pi, searchDescription);
	registerBm25Tool(pi);
	registerSemgrepTool(pi, semgrepDescription);
	registerFzfTool(pi, fzfDescription);
	registerFdTool(pi, fdDescription);
	registerRipgrepTool(pi, ripgrepDescription);
	registerAstGrepTool(pi, astGrepDescription);
	registerTokeiTool(pi, tokeiDescription);
	registerJscpdTool(pi, jscpdDescription);
}
