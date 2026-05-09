import { describe, test, expect } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { BrootTopologyMapper, normalizedTypeFilters, parsePrintTreeRows, topologyFromPrintTreeStdout } from "../src/broot-topology.ts";

describe("broot-topology", () => {
	test("parsePrintTreeRows derives depth + names", () => {
		const ascii = [
			"project",
			"├── src",
			"│   └── main.ts",
			"└── README.md",
			"",
		].join("\n");
		const rows = parsePrintTreeRows(ascii);
		expect(rows.map(r => r.name)).toEqual(["src", "main.ts", "README.md"]);
		expect(rows.every(r => r.depth >= 1)).toBe(true);
	});

	test("topologyFromPrintTreeStdout nests files", () => {
		const topo = topologyFromPrintTreeStdout(["root", "└── child.txt", ""].join("\n"));
		expect(topo).not.toBeNull();
		const first = topo![0];
		expect(first.kind).toBe("file");
		expect(first.name).toBe("child.txt");
		expect(first.relPath).toBe("child.txt");
	});

	test("normalizedTypeFilters expands dir alias", () => {
		const filters = normalizedTypeFilters(["dir", "TS", ".md"]);
		expect(filters.has("directory")).toBe(true);
		expect(filters.has("ts")).toBe(true);
		expect(filters.has("md")).toBe(true);
	});

	test("native mapper respects depth + type filters", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pi-topo-"));
		await fs.mkdir(path.join(tmp, "nested"));
		await fs.writeFile(path.join(tmp, "keep.ts"), "//");
		await fs.writeFile(path.join(tmp, "skip.md"), "#");

		const mapper = new BrootTopologyMapper(() => null);
		const res = await mapper.map({
			path: tmp,
			depth: 2,
			includeHidden: false,
			includeGitStatus: false,
			filterTypes: ["ts"],
			preferBroot: false,
		});

		expect(res.method).toBe("native");
		const names = flattenNames(res.topology);
		expect(names).toContain("keep.ts");
		expect(names.some(n => n.endsWith(".md"))).toBe(false);
	});

	test("native mapper applies size window", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pi-topo-size-"));
		await fs.writeFile(path.join(tmp, "big.txt"), "x".repeat(100));
		await fs.writeFile(path.join(tmp, "small.txt"), "x".repeat(20));

		const mapper = new BrootTopologyMapper(() => null);
		const res = await mapper.map({
			path: tmp,
			depth: 1,
			includeGitStatus: false,
			minSizeBytes: 10,
			maxSizeBytes: 50,
			preferBroot: false,
		});

		const names = flattenNames(res.topology);
		expect(names).toContain("small.txt");
		expect(names).not.toContain("big.txt");
	});
});

function flattenNames(nodes: { name: string; children?: typeof nodes }[]): string[] {
	const acc: string[] = [];
	for (const n of nodes) {
		acc.push(n.name);
		if (n.children?.length) acc.push(...flattenNames(n.children));
	}
	return acc;
}
