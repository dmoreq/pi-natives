import { describe, expect, it } from "bun:test";

import { resolvedEditEnhancedCallMetaParts } from "../src/edit-render.ts";

describe("resolvedEditEnhancedCallMetaParts", () => {
	it("shows backup chip when preview is false and backup is omitted", () => {
		expect(resolvedEditEnhancedCallMetaParts({ path: "a.ts", pattern: "$X", replacement: "$Y" }).sort()).toEqual(
			["backup"].sort(),
		);
	});

	it("omits backup chip during preview-only runs even if backup omitted", () => {
		expect(resolvedEditEnhancedCallMetaParts({ path: "a.ts", pattern: "$X", replacement: "$Y", preview: true })).toEqual([
			"preview",
		]);
	});

	it("shows no-backup when backups explicitly disabled while not previewing", () => {
		expect(resolvedEditEnhancedCallMetaParts({ path: "a.ts", pattern: "$X", replacement: "$Y", backup: false })).toEqual([
			"no-backup",
		]);
	});

	it("includes preview and node hints together", () => {
		expect(
			resolvedEditEnhancedCallMetaParts({
				path: "a.ts",
				pattern: "$X",
				replacement: "$Y",
				preview: true,
				nodeType: "class",
			}).sort(),
		).toEqual(["class", "preview"].sort());
	});
});
