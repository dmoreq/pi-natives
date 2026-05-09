/**
 * Output parsing utilities for shell command results
 * 
 * Handles JSON extraction, Nushell table parsing, and structured data interpretation.
 */

import { sanitizeKey, splitPipeCells } from "./pipeline-enhancer";

/**
 * Safe JSON parsing that returns undefined on failure
 */
export function safeJsonParse(s: string): unknown | undefined {
	try {
		return JSON.parse(s);
	} catch {
		return undefined;
	}
}

/**
 * Best-effort: find outermost `{`/`[` blob for sloppy stdout.
 */
export function extractJson(text: string): unknown | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;
	
	// Look for JSON array or object at start
	let startIdx = -1;
	let startChar = '';
	
	for (let i = 0; i < trimmed.length; i++) {
		const char = trimmed[i];
		if (char === '{' || char === '[') {
			startIdx = i;
			startChar = char;
			break;
		}
	}
	
	if (startIdx === -1) return undefined;
	
	// Find matching closing brace
	const endChar = startChar === '{' ? '}' : ']';
	let depth = 0;
	let endIdx = -1;
	
	for (let i = startIdx; i < trimmed.length; i++) {
		const char = trimmed[i];
		if (char === startChar) {
			depth++;
		} else if (char === endChar) {
			depth--;
			if (depth === 0) {
				endIdx = i;
				break;
			}
		}
	}
	
	if (endIdx === -1) return undefined;
	
	const jsonBlob = trimmed.slice(startIdx, endIdx + 1);
	return safeJsonParse(jsonBlob);
}

/**
 * Parse Nushell ASCII table output into structured data
 * Handles both pipe-delimited and box-drawing formats
 */
export function parseNushellTable(text: string): Array<Record<string, string>> {
	const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
	
	if (lines.length < 2) return [];
	
	// Check if this is a Nushell box-drawing table
	if (lines[0].includes('─') && lines[0].includes('┬')) {
		return parseNushellBoxTable(text);
	}
	
	// Fallback to pipe-delimited parsing
	// First line should be headers
	const headerLine = lines[0];
	if (!headerLine.includes('|')) return [];
	
	const headers = splitPipeCells(headerLine).map(sanitizeKey);
	if (headers.length === 0) return [];
	
	const rows: Array<Record<string, string>> = [];
	
	// Skip header separator line if present (usually contains dashes)
	let dataStartIdx = 1;
	if (lines.length > 1 && lines[1].includes('---')) {
		dataStartIdx = 2;
	}
	
	// Parse data rows
	for (let i = dataStartIdx; i < lines.length; i++) {
		const line = lines[i];
		if (!line.includes('|')) continue;
		
		const cells = splitPipeCells(line);
		if (cells.length === 0) continue;
		
		const row: Record<string, string> = {};
		
		// Map cells to headers
		for (let j = 0; j < Math.min(headers.length, cells.length); j++) {
			const header = headers[j];
			const value = cells[j];
			if (header) {
				row[header] = value;
			}
		}
		
		// Only add row if it has at least one non-empty value
		if (Object.values(row).some(val => val.length > 0)) {
			rows.push(row);
		}
	}
	
	return rows;
}

/**
 * Parse Nushell box-drawing table format
 */
function parseNushellBoxTable(text: string): Array<Record<string, string>> {
	const lines = text.split('\n').filter(line => line.trim().length > 0);
	
	// Find header line (contains column names, usually the second line)
	let headerLineIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.includes('│') && !line.includes('─') && line.trim().match(/^\s*#\s*│/)) {
			headerLineIdx = i;
			break;
		}
	}
	
	if (headerLineIdx === -1) return [];
	
	const headerLine = lines[headerLineIdx];
	
	// Parse headers by splitting on │ and filtering
	const rawHeaders = headerLine.split('│').map(cell => cell.trim());
	const headers: string[] = [];
	
	// Skip the first cell if it's just '#' (row number header)
	let startIdx = 0;
	if (rawHeaders[0] === '#') {
		startIdx = 1;
	}
	
	for (let i = startIdx; i < rawHeaders.length; i++) {
		const header = rawHeaders[i];
		if (header && header.length > 0) {
			headers.push(sanitizeKey(header));
		}
	}
	
	if (headers.length === 0) return [];
	
	const rows: Array<Record<string, string>> = [];
	
	// Parse data rows (after header)
	for (let i = headerLineIdx + 1; i < lines.length; i++) {
		const line = lines[i];
		
		// Skip separator lines
		if (line.includes('─')) continue;
		if (!line.includes('│')) continue;
		
		const cells = line.split('│').map(cell => cell.trim());
		
		if (cells.length === 0) continue;
		
		const row: Record<string, string> = {};
		
		// Skip first cell if it's a row number, align with headers
		let cellOffset = 0;
		if (cells[0].match(/^\s*[0-9]+\s*$/)) {
			cellOffset = 1;
		}
		
		// Map remaining cells to headers
		for (let j = 0; j < headers.length && (j + cellOffset) < cells.length; j++) {
			const header = headers[j];
			const value = cells[j + cellOffset];
			if (header && value !== undefined) {
				row[header] = value;
			}
		}
		
		// Only add row if it has meaningful data
		if (Object.keys(row).length > 0 && Object.values(row).some(val => val.length > 0)) {
			rows.push(row);
		}
	}
	
	return rows;
}

/**
 * Try to interpret stdout as structured data (JSON first, then Nushell table)
 */
export function tryInterpretStructured(stdout: string): { structured: boolean; output: unknown } {
	if (!stdout?.trim()) {
		return { structured: false, output: stdout };
	}
	
	// Try JSON parsing first
	const jsonResult = safeJsonParse(stdout.trim());
	if (jsonResult !== undefined) {
		return { structured: true, output: jsonResult };
	}
	
	// Try extracting JSON from mixed output
	const extractedJson = extractJson(stdout);
	if (extractedJson !== undefined) {
		return { structured: true, output: extractedJson };
	}
	
	// Try Nushell table parsing
	if (stdout.includes('|')) {
		const tableResult = parseNushellTable(stdout);
		if (tableResult.length > 0) {
			return { structured: true, output: tableResult };
		}
	}
	
	// No structured interpretation possible
	return { structured: false, output: stdout };
}