/**
 * Base error class for all pi-sherlock custom errors.
 * Eliminates the duplicated `extends Error { constructor(m) { super(m); this.name = "XxxError"; } }` pattern.
 */
export class PiNativeError extends Error {
	constructor(message: string, name: string) {
		super(message);
		this.name = name;
	}
}

/** Create a named error subclass factory. */
export function createErrorClass(name: string): typeof PiNativeError & { new (message: string): PiNativeError } {
	return class extends PiNativeError {
		constructor(message: string) {
			super(message, name);
		}
	} as any;
}

// Concrete error types used across tools
export const GrepError = createErrorClass("GrepError");
export type GrepError = InstanceType<typeof GrepError>;

export const SemgrepError = createErrorClass("SemgrepError");
export type SemgrepError = InstanceType<typeof SemgrepError>;

export const FzfError = createErrorClass("FzfError");
export type FzfError = InstanceType<typeof FzfError>;

export const FdError = createErrorClass("FdError");
export type FdError = InstanceType<typeof FdError>;

export const AstGrepError = createErrorClass("AstGrepError");
export type AstGrepError = InstanceType<typeof AstGrepError>;

export const TokeiError = createErrorClass("TokeiError");
export type TokeiError = InstanceType<typeof TokeiError>;

export const JscpdError = createErrorClass("JscpdError");
export type JscpdError = InstanceType<typeof JscpdError>;
