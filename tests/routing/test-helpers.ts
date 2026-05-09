import { createBinaryRequirements } from "../../src/core/binary-manager";
import type { BinaryAvailabilitySnapshot } from "../../src/routing/types";

/** Snapshot with every known extension binary marked available (deterministic tests). */
export function allBinariesAvailableSnapshot(): BinaryAvailabilitySnapshot {
	const byBinary: BinaryAvailabilitySnapshot["byBinary"] = {};
	for (const req of Object.values(createBinaryRequirements())) {
		byBinary[req.binary] = { available: true };
	}
	return { byBinary };
}
