/**
 * Repository topology mapper — hierarchical directory trees + metadata for agents.
 *
 * When `br`/`broot` exists, `:print_tree` ASCII is parsed into the same nested shape
 * as the native walker. Structured JSON is emitted by tooling (`ls-enhanced`).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { checkBinary } from "./shared/cli";
import { TopologyError } from "./shared/errors";

export type DirectoryKind = "file" | "directory" | "symlink";

export type FileCategory = "code" | "markup" | "doc" | "config" | "data" | "unknown";

export interface DirectoryNode {
	name: string;
	relPath: string;
	kind: DirectoryKind;
	extension?: string;
	sizeBytes?: number;
	fileCategory?: FileCategory;
	gitStatus?: string;
	children?: DirectoryNode[];
}

export interface BrootOptions {
	path: string;
	depth?: number;
	includeHidden?: boolean;
	includeGitStatus?: boolean;
	filterTypes?: string[];
	minSizeBytes?: number;
	maxSizeBytes?: number;
	preferBroot?: boolean;
	cwd?: string;
}

export interface BrootResult {
	topology: DirectoryNode[];
	totalFiles: number;
	totalDirectories: number;
	scanTime: number;
	method: "broot" | "native";
	gitAware: boolean;
	resolvedRoot: string;
}

const ansiRe = /\u001b\[[\d;]*m/g;
const BROOT_TIMEOUT_MS = 60_000;

const CODE_EXTS = new Set([
	"ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "vue", "svelte", "rs", "go", "py", "rb", "php", "java", "kt", "kts", "swift", "cs",
	"cpp", "cc", "cxx", "c", "h", "hpp", "scala", "clj", "erl", "ex", "exs", "dart",
]);
const MARKUP_EXTS = new Set(["html", "htm", "md", "mdx", "rst", "adoc"]);
const DOC_EXTS = new Set(["txt", "log"]);
const CONFIG_EXTS = new Set(["json", "yaml", "yml", "toml", "ini", "cfg", "conf"]);
const DATA_EXTS = new Set(["csv", "tsv", "xml"]);

function stripAnsi(s: string): string {
	return s.replace(ansiRe, "");
}

function stripTrailingAnnotation(name: string): string {
	let n = name.trim();
	const bracket = /\s+\[[^\]]+\]\s*$/.exec(n);
	if (bracket?.index !== undefined) n = n.slice(0, bracket.index).trim();
	return n.trim();
}

export function resolveBrootBinary(): "br" | "broot" | null {
	if (checkBinary("br")) return "br";
	if (checkBinary("broot")) return "broot";
	return null;
}

function categorizeExtension(extension: string): FileCategory {
	const e = extension.toLowerCase();
	if (CODE_EXTS.has(e)) return "code";
	if (MARKUP_EXTS.has(e)) return "markup";
	if (DOC_EXTS.has(e)) return "doc";
	if (CONFIG_EXTS.has(e)) return "config";
	if (DATA_EXTS.has(e)) return "data";
	return "unknown";
}

function classifyNode(name: string, kind: DirectoryKind): Pick<DirectoryNode, "extension" | "fileCategory"> {
	const extRaw = kind === "directory" ? "" : path.extname(name).replace(/^\./, "");
	const extension = extRaw.toLowerCase() || undefined;
	const fileCategory: FileCategory =
		kind === "directory" || kind === "symlink" ? "unknown" : categorizeExtension(extRaw.toLowerCase());
	return { extension, fileCategory };
}

export interface ParsedTreeRow {
	depth: number;
	name: string;
}

/** Parse `:print_tree` output into indentation rows for tests/broot integration. */
export function parsePrintTreeRows(stdout: string): ParsedTreeRow[] {
	const rows: ParsedTreeRow[] = [];

	const lines = stripAnsi(stdout)
		.split(/\r?\n/)
		.map(l => l.trimEnd())
		.filter(l => l.trim().length > 0);

	for (const raw of lines) {
		const line = stripAnsi(raw).trimEnd();
		let branchTok: "├──" | "└──" | undefined;
		let tokIdx = -1;
		for (const cand of ["├──", "└──"] as const) {
			const i = line.indexOf(cand);
			if (i >= 0 && (tokIdx < 0 || i < tokIdx)) {
				branchTok = cand;
				tokIdx = i;
			}
		}
		if (!branchTok || tokIdx < 0) continue;

		const prefix = line.slice(0, tokIdx).replace(/\t/g, "    ");
		const rest = stripTrailingAnnotation(line.slice(tokIdx + branchTok.length).trim());
		if (!rest) continue;

		const depthGuess = Math.max(1, Math.floor(prefix.length / 4) + 1);
		rows.push({ depth: depthGuess, name: rest });
	}

	return rows;
}

function sanitizeRelPaths(nodes: DirectoryNode[]): boolean {
	for (const n of nodes) {
		const norm = path.posix.normalize((n.relPath || "").trim() || n.name || ".");
		if (norm.includes("..")) return false;
		n.relPath = norm === "." ? n.name === "." ? "." : norm : norm;

		const kids = n.children;
		if (kids?.length) {
			if (!sanitizeRelPaths(kids)) return false;
		} else if (n.kind !== "directory") {

			delete n.children;
		}
	}

	return true;
}

function rowsToTopology(rows: ParsedTreeRow[]): DirectoryNode[] | null {
	if (!rows.length) return null;

	const top: DirectoryNode[] = [];

	const stk: DirectoryNode[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const next = rows[i + 1];

		while (stk.length > 0 && stk.length >= row.depth) {
			stk.pop();
		}

		const guessedDir = !!(next && next.depth > row.depth);
		const parent = stk.at(-1);
		const kind: DirectoryKind = guessedDir ? "directory" : "file";

		const cls = classifyNode(row.name, kind);

		const node: DirectoryNode = {
			name: row.name,
			relPath: "",
			kind,
			extension: cls.extension,
			fileCategory: cls.fileCategory,
			...(kind === "directory" ? { children: [] as DirectoryNode[] } : {}),
		};

		if (!parent) {
			node.relPath = row.name;
			top.push(node);
		} else {
			const base = parent.relPath === "." ? "" : parent.relPath;
			node.relPath = base ? path.posix.join(base, row.name) : row.name;
			parent.children ??= [];
			parent.children.push(node);
		}

		if (kind === "directory") stk.push(node);
	}

	return sanitizeRelPaths(top) ? top : null;
}

export function topologyFromPrintTreeStdout(stdout: string): DirectoryNode[] | null {
	return rowsToTopology(parsePrintTreeRows(stdout));
}

async function runBrootPrintTree(bin: string, rootAbs: string): Promise<{ code: number; stdout: string }> {
	return await new Promise((resolve, reject) => {
		const argv = ["--cmd", ":print_tree", "--color", "no", rootAbs];

		let stdout = "";
		let done = false;
		const proc = spawn(bin, argv, {
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const tm = setTimeout(() => {
			if (done) return;
			proc.kill();
			reject(new Error(`broot launch timed out after ${BROOT_TIMEOUT_MS}ms`));
		}, BROOT_TIMEOUT_MS);

		proc.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		proc.on("error", err => {
			done = true;
			clearTimeout(tm);
			reject(err);
		});
		proc.on("close", code => {
			done = true;
			clearTimeout(tm);
			resolve({ code: code ?? 1, stdout });
		});
	});
}

async function refreshStats(rootAbs: string, nodes: DirectoryNode[]): Promise<void> {
	for (const n of nodes) {
		const rp = (n.relPath || n.name || "").trim();
		const abs = path.isAbsolute(rp) ? path.normalize(rp) : path.resolve(rootAbs, rp);

		let st;
		try {

			st = await fs.lstat(abs);
		} catch {


			const kids = n.children;
			if (kids?.length) await refreshStats(rootAbs, kids);
			continue;


		}

		n.kind = st.isSymbolicLink() ? "symlink" : st.isDirectory() ? "directory" : "file";
		Object.assign(n, classifyNode(n.name, n.kind));
		n.sizeBytes = st.isDirectory() ? undefined : st.size;

		const kidsAfter = n.children;
		if (kidsAfter?.length && n.kind === "directory") await refreshStats(rootAbs, kidsAfter);
		else if (n.kind !== "directory") delete n.children;


	}



}

async function scanFilesystemNative(opts: { rootAbs: string; depth: number; includeHidden: boolean }): Promise<
	DirectoryNode[]
> {
	const readLevel = async (relPosix: string, absDir: string, levelsRemaining: number): Promise<DirectoryNode[]> => {


		if (levelsRemaining <= 0) return [];


		let ents;
		try {


			ents = await fs.readdir(absDir, { withFileTypes: true });


		} catch {


			return [];

		}

		const ordered = [...ents].sort((a, b) => {
			const aDir = !!a.isDirectory();


			const bDir = !!b.isDirectory();


			if (aDir !== bDir) return aDir ? -1 : 1;


			return a.name.localeCompare(b.name);


		});

		const out: DirectoryNode[] = [];

		for (const ent of ordered) {
			const nm = ent.name;


			if (!opts.includeHidden && nm.startsWith(".")) continue;


			const absChild = path.join(absDir, nm);


			const relChild = relPosix ? path.posix.join(relPosix, nm) : nm;


			let stats;
			let kind: DirectoryKind = ent.isSymbolicLink()
				? "symlink"
				: ent.isDirectory()


					? "directory"


					: "file";

			try {


				stats = await fs.lstat(absChild);

				kind = stats.isSymbolicLink()
					? "symlink"


					: stats.isDirectory()


						? "directory"


						: "file";
			} catch {


				stats = undefined;

			}

			const cls = classifyNode(nm, kind);


			const node: DirectoryNode = {


				name: nm,


				relPath: relChild,


				kind,


				extension: cls.extension,


				fileCategory: cls.fileCategory,


				sizeBytes: kind !== "directory" ? stats?.size : undefined,

			};

			const canDescend =
				kind === "directory" &&
				stats &&
				!stats.isSymbolicLink() &&
				nm !== ".git" &&
				levelsRemaining > 1;

			node.children =
				canDescend

					? await readLevel(relChild, absChild, levelsRemaining - 1)

					: kind === "directory"

						? undefined


						: undefined;

			if (kind === "directory" && !node.children) delete node.children;

			out.push(node);
		}

		return out;

	};


	return readLevel("", opts.rootAbs, opts.depth);

}

function posixKey(p: string): string {
	return p.split(path.sep).join("/");


}

function gitRepoRoot(absPath: string): string | null {
	const proc = spawnSync("git", ["-C", absPath, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
	return proc.status === 0 && proc.stdout?.trim().length ? proc.stdout.trim() : null;


}

function porcelainStatusMap(repoRootAbs: string): Map<string, string> {
	const proc = spawnSync("git", ["-C", repoRootAbs, "status", "--porcelain=v1"], { encoding: "utf8" });
	const map = new Map<string, string>();
	if (proc.status !== 0 || !proc.stdout) return map;



	for (const raw of proc.stdout.split(/\r?\n/)) {

		const line = raw;

		if (line.length < 4 || line.startsWith("#")) continue;



		const xy = line.slice(0, 2);


		let fp = line.slice(3);



		fp = fp.replace(/^"|"$/g, "");


		fp = fp.includes(" -> ")
			? (fp.split(" -> ").slice(-1)[0]?.trim() ?? fp).trim()


			: fp;


		if (!fp) continue;



		map.set(posixKey(fp), xy);


	}

	return map;

}

function applyGit(scanRootAbs: string, repoRootAbs: string | null, pmap: Map<string, string>, nodes: DirectoryNode[]) {
	if (!repoRootAbs) return;


	forEachNode(nodes, n => {


		if (n.kind === "directory") return;


		const joined = path.resolve(scanRootAbs, n.relPath || n.name);


		const rk = posixKey(path.relative(repoRootAbs, joined));


		const st = pmap.get(rk);

		if (st) n.gitStatus = st;

	});


}

function forEachNode(nodes: DirectoryNode[], fn: (n: DirectoryNode) => void) {


	for (const n of nodes) {


		fn(n);


		if (n.children?.length) forEachNode(n.children, fn);

	}



}

export function normalizedTypeFilters(filters?: string[]): Set<string> {
	const set = new Set<string>();
	for (const f of filters ?? []) {
		let t = f.trim().toLowerCase();
		if (!t) continue;


		if (t === "dir") t = "directory";


		t = t.replace(/^\.+/, "");


		set.add(t);


	}


	return set;

}

function leafMatches(filters: Set<string>, node: DirectoryNode): boolean {
	if (!filters.size) return true;
	if (node.kind === "directory") return filters.has("directory");
	if (filters.has(node.kind)) return true;
	if (node.fileCategory && filters.has(node.fileCategory)) return true;
	if (node.extension && filters.has(node.extension)) return true;
	return false;
}

/** Remove dot-names when agents opt out — native scan skips them early; broot ASCII may include them. */
export function pruneHidden(nodes: DirectoryNode[], includeHidden: boolean): DirectoryNode[] {
	if (includeHidden) return nodes;
	const out: DirectoryNode[] = [];
	for (const n of nodes) {
		if (n.name.startsWith(".")) continue;
		const kids = n.children?.length ? pruneHidden(n.children, false) : undefined;
		const copy: DirectoryNode = { ...n };
		copy.children = kids?.length ? kids : undefined;
		if (copy.kind === "directory" && !kids?.length) delete copy.children;
		out.push(copy);
	}
	return out;
}

/** Native walker never traverses `.git`; strip broot internals for parity. */
export function collapseDotGitSubtree(nodes: DirectoryNode[]): DirectoryNode[] {
	return nodes.map(n => {
		if (n.name === ".git" && n.kind === "directory") {
			const c = { ...n };
			delete c.children;
			return c;
		}
		const ch = n.children?.length ? collapseDotGitSubtree(n.children) : undefined;
		if (!ch?.length) {
			const c = { ...n };
			if (c.kind === "directory") delete c.children;
			return c;
		}
		return { ...n, children: ch };
	});
}

function limitTopologyDepth(nodes: DirectoryNode[], maxDepth: number, cur = 1): void {
	for (const n of nodes) {
		if (!n.children?.length) continue;
		if (cur >= maxDepth) {
			delete n.children;
			continue;
		}
		limitTopologyDepth(n.children, maxDepth, cur + 1);
	}
}

function filterTree(nodes: DirectoryNode[], filters: Set<string>, minS?: number, maxS?: number): DirectoryNode[] {
	const next: DirectoryNode[] = [];
	for (const n of nodes) {
		if (n.kind === "directory") {
			const kidsFiltered = n.children?.length ? filterTree(n.children, filters, minS, maxS) : [];
			const wantDirSelf = filters.size === 0 || filters.has("directory");
			const keep = kidsFiltered.length > 0 || wantDirSelf;
			if (!keep) continue;
			const copy: DirectoryNode = { ...n };
			if (kidsFiltered.length) copy.children = kidsFiltered;
			else delete copy.children;
			next.push(copy);
			continue;
		}
		if (!leafMatches(filters, n)) continue;
		const sz = n.sizeBytes;
		const sizing = minS != null || maxS != null;
		if (sizing && (sz == null || minS != null && sz < minS || maxS != null && sz > maxS)) continue;
		const plain: DirectoryNode = { ...n };
		delete plain.children;
		next.push(plain);
	}
	return next;
}

function summarizeTotals(nodes: DirectoryNode[]): { files: number; dirs: number } {
	let files = 0;
	let dirs = 0;
	forEachNode(nodes, n => {
		if (n.kind === "directory") dirs += 1;
		else files += 1;
	});
	return { files, dirs };
}

async function validateDirectoryRoot(abs: string): Promise<void> {
	let st;
	try {
		st = await fs.stat(abs);
	} catch {
		throw new TopologyError(`Cannot access path: ${abs}`);
	}
	if (!st.isDirectory()) throw new TopologyError(`Not a directory: ${abs}`);
}

export class BrootTopologyMapper {
	constructor(
		private readonly resolveBin: () => ReturnType<typeof resolveBrootBinary> = resolveBrootBinary,
	) {}

	async map(opts: BrootOptions): Promise<BrootResult> {
		const t0 = performance.now();
		const depth = opts.depth ?? 12;
		const includeHidden = opts.includeHidden === true;
		const includeGit = opts.includeGitStatus !== false;
		const cw = opts.cwd ?? process.cwd();
		const target = (opts.path || ".").trim() || ".";
		const resolvedRoot =
			path.isAbsolute(target) ? path.normalize(target) : path.resolve(cw, target);
		await validateDirectoryRoot(resolvedRoot);

		const filters = normalizedTypeFilters(opts.filterTypes);

		let method: BrootResult["method"] = "native";
		let topology: DirectoryNode[] = [];
		let scannedWithBroot = false;

		const bin = opts.preferBroot !== false ? this.resolveBin() : null;
		if (bin) {
			try {
				const { code, stdout } = await runBrootPrintTree(bin, resolvedRoot);
				const parsed = code === 0 ? topologyFromPrintTreeStdout(stdout) : null;
				if (parsed) {
					topology = parsed;
					await refreshStats(resolvedRoot, topology);
					scannedWithBroot = true;
					method = "broot";
				}
			} catch {

			}
		}

		if (!scannedWithBroot)
			topology = await scanFilesystemNative({
				rootAbs: resolvedRoot,
				depth,
				includeHidden,
			});

		topology = collapseDotGitSubtree(pruneHidden(topology, includeHidden));
		limitTopologyDepth(topology, depth);

		const repoRoot = gitRepoRoot(resolvedRoot);
		let gitAware = false;
		if (includeGit && repoRoot) {
			applyGit(resolvedRoot, repoRoot, porcelainStatusMap(repoRoot), topology);
			gitAware = true;
		}

		topology =
			filters.size > 0 || opts.minSizeBytes != null || opts.maxSizeBytes != null
				? filterTree(topology, filters, opts.minSizeBytes, opts.maxSizeBytes)
				: topology;

		const totals = summarizeTotals(topology);

		return {
			topology,
			totalFiles: totals.files,
			totalDirectories: totals.dirs,
			scanTime: Math.round(performance.now() - t0),
			method,
			gitAware,
			resolvedRoot,
		};
	}
}