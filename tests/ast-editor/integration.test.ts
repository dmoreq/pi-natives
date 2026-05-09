/**
 * Integration tests for the decomposed AST editor module
 */

import { describe, test, expect } from "bun:test";
import { AstFileEditor } from "../../src/ast-editor";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("AST Editor Integration", () => {
	
	test("should maintain backward compatibility", () => {
		// Verify that the main exports are still available
		expect(AstFileEditor).toBeDefined();
		expect(typeof AstFileEditor).toBe("function");
	});
	
	test("should create editor instance", () => {
		const editor = new AstFileEditor();
		expect(editor).toBeDefined();
		expect(typeof editor.edit).toBe("function");
		expect(typeof editor.restore).toBe("function");
	});
	
	test("should handle simple text file editing", async () => {
		// Create a temporary file
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ast-editor-test-"));
		const testFile = path.join(tmpDir, "test.txt");
		const content = "Hello world\nThis is a test file\nHello again";
		
		await fs.writeFile(testFile, content, "utf8");
		
		try {
			const editor = new AstFileEditor();
			
			// Perform a simple replacement
			const result = await editor.edit({
				path: testFile,
				pattern: "Hello",
				replacement: "Hi",
				preview: false,
				backup: false
			});
			
			expect(result.matchCount).toBe(2);
			expect(result.method).toBe("native-string");
			expect(result.summary).toContain("2 literal occurrences");
			
			// Verify file was actually changed
			const newContent = await fs.readFile(testFile, "utf8");
			expect(newContent).toBe("Hi world\nThis is a test file\nHi again");
			
		} finally {
			// Cleanup
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
	
	test("should handle preview mode", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ast-editor-preview-"));
		const testFile = path.join(tmpDir, "test.txt");
		const originalContent = "Hello world";
		
		await fs.writeFile(testFile, originalContent, "utf8");
		
		try {
			const editor = new AstFileEditor();
			
			const result = await editor.edit({
				path: testFile,
				pattern: "Hello",
				replacement: "Hi",
				preview: true
			});
			
			expect(result.matchCount).toBe(1);
			expect(result.preview).toBeDefined();
			
			// Verify file was NOT changed in preview mode
			const content = await fs.readFile(testFile, "utf8");
			expect(content).toBe(originalContent);
			
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
	
	test("should create and manage backups", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ast-editor-backup-"));
		const testFile = path.join(tmpDir, "test.txt");
		const content = "Original content";
		
		await fs.writeFile(testFile, content, "utf8");
		
		try {
			const editor = new AstFileEditor();
			
			const result = await editor.edit({
				path: testFile,
				pattern: "Original",
				replacement: "Modified",
				backup: true
			});
			
			expect(result.backupPath).toBeDefined();
			expect(result.matchCount).toBe(1);
			
			// Verify backup was created
			if (result.backupPath) {
				const backupContent = await fs.readFile(result.backupPath, "utf8");
				expect(backupContent).toBe(content);
			}
			
			// Verify file was changed
			const newContent = await fs.readFile(testFile, "utf8");
			expect(newContent).toBe("Modified content");
			
			// Test restoration
			if (result.backupPath) {
				await editor.restore(testFile, result.backupPath);
				const restoredContent = await fs.readFile(testFile, "utf8");
				expect(restoredContent).toBe(content);
			}
			
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
	
	test("should handle missing files gracefully", async () => {
		const editor = new AstFileEditor();
		
		await expect(async () => {
			await editor.edit({
				path: "/non/existent/file.txt",
				pattern: "test",
				replacement: "demo"
			});
		}).toThrow();
	});
	
	test("should handle empty patterns gracefully", async () => {
		const editor = new AstFileEditor();
		
		await expect(async () => {
			await editor.edit({
				path: "test.txt",
				pattern: "",
				replacement: "demo"
			});
		}).toThrow();
	});
	
	test("should generate scope warnings", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ast-editor-scope-"));
		const testFile = path.join(tmpDir, "test.ts");
		const content = "function test() { return 'hello'; }";
		
		await fs.writeFile(testFile, content, "utf8");
		
		try {
			const editor = new AstFileEditor();
			
			const result = await editor.edit({
				path: testFile,
				pattern: "hello",
				replacement: "world",
				scope: "function", // Reserved scope
				preview: true,
				backup: false
			});
			
			expect(result.warnings.some(w => w.includes("reserved"))).toBe(true);
			
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
});