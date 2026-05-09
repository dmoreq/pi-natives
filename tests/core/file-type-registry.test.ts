/**
 * Tests for the File Type Registry
 */

import { describe, test, expect } from "bun:test";
import { 
	FileTypeRegistry, 
	FileType, 
	CodeLanguage, 
	DataFormat 
} from "../../src/core/file-type-registry";

describe("FileTypeRegistry", () => {
	
	test("should classify TypeScript files correctly", () => {
		const tsFile = FileTypeRegistry.classify("src/component.ts");
		expect(tsFile.type).toBe(FileType.CODE);
		expect(tsFile.language).toBe(CodeLanguage.TYPESCRIPT);
		expect(tsFile.extension).toBe(".ts");
		expect(tsFile.confidence).toBe(1.0);
		expect(tsFile.isBinary).toBe(false);
		expect(tsFile.isTextEditable).toBe(true);
	});
	
	test("should classify TSX files correctly", () => {
		const tsxFile = FileTypeRegistry.classify("components/Button.tsx");
		expect(tsxFile.type).toBe(FileType.CODE);
		expect(tsxFile.language).toBe(CodeLanguage.TSX);
		expect(tsxFile.extension).toBe(".tsx");
	});
	
	test("should classify JavaScript files correctly", () => {
		const jsFile = FileTypeRegistry.classify("utils/helper.js");
		expect(jsFile.type).toBe(FileType.CODE);
		expect(jsFile.language).toBe(CodeLanguage.JAVASCRIPT);
		expect(jsFile.extension).toBe(".js");
		
		const mjsFile = FileTypeRegistry.classify("module.mjs");
		expect(mjsFile.language).toBe(CodeLanguage.JAVASCRIPT);
		
		const cjsFile = FileTypeRegistry.classify("config.cjs");
		expect(cjsFile.language).toBe(CodeLanguage.JAVASCRIPT);
	});
	
	test("should classify Python files correctly", () => {
		const pyFile = FileTypeRegistry.classify("script.py");
		expect(pyFile.type).toBe(FileType.CODE);
		expect(pyFile.language).toBe(CodeLanguage.PYTHON);
		
		const pyiFile = FileTypeRegistry.classify("types.pyi");
		expect(pyiFile.language).toBe(CodeLanguage.PYTHON);
	});
	
	test("should classify systems languages correctly", () => {
		const rustFile = FileTypeRegistry.classify("main.rs");
		expect(rustFile.type).toBe(FileType.CODE);
		expect(rustFile.language).toBe(CodeLanguage.RUST);
		
		const goFile = FileTypeRegistry.classify("server.go");
		expect(goFile.type).toBe(FileType.CODE);
		expect(goFile.language).toBe(CodeLanguage.GO);
		
		const cFile = FileTypeRegistry.classify("util.c");
		expect(cFile.type).toBe(FileType.CODE);
		expect(cFile.language).toBe(CodeLanguage.C);
		
		const cppFile = FileTypeRegistry.classify("algo.cpp");
		expect(cppFile.type).toBe(FileType.CODE);
		expect(cppFile.language).toBe(CodeLanguage.CPP);
	});
	
	test("should classify JVM languages correctly", () => {
		const javaFile = FileTypeRegistry.classify("Service.java");
		expect(javaFile.type).toBe(FileType.CODE);
		expect(javaFile.language).toBe(CodeLanguage.JAVA);
		
		const kotlinFile = FileTypeRegistry.classify("App.kt");
		expect(kotlinFile.type).toBe(FileType.CODE);
		expect(kotlinFile.language).toBe(CodeLanguage.KOTLIN);
		
		const scalaFile = FileTypeRegistry.classify("Model.scala");
		expect(scalaFile.type).toBe(FileType.CODE);
		expect(scalaFile.language).toBe(CodeLanguage.SCALA);
	});
	
	test("should classify other languages correctly", () => {
		const csFile = FileTypeRegistry.classify("Program.cs");
		expect(csFile.type).toBe(FileType.CODE);
		expect(csFile.language).toBe(CodeLanguage.CSHARP);
		
		const phpFile = FileTypeRegistry.classify("index.php");
		expect(phpFile.type).toBe(FileType.CODE);
		expect(phpFile.language).toBe(CodeLanguage.PHP);
		
		const rubyFile = FileTypeRegistry.classify("script.rb");
		expect(rubyFile.type).toBe(FileType.CODE);
		expect(rubyFile.language).toBe(CodeLanguage.RUBY);
		
		const swiftFile = FileTypeRegistry.classify("App.swift");
		expect(swiftFile.type).toBe(FileType.CODE);
		expect(swiftFile.language).toBe(CodeLanguage.SWIFT);
	});
	
	test("should classify data formats correctly", () => {
		const jsonFile = FileTypeRegistry.classify("config.json");
		expect(jsonFile.type).toBe(FileType.DATA);
		expect(jsonFile.format).toBe(DataFormat.JSON);
		
		const yamlFile = FileTypeRegistry.classify("deploy.yaml");
		expect(yamlFile.type).toBe(FileType.DATA);
		expect(yamlFile.format).toBe(DataFormat.YAML);
		
		const ymlFile = FileTypeRegistry.classify("config.yml");
		expect(ymlFile.format).toBe(DataFormat.YAML);
		
		const xmlFile = FileTypeRegistry.classify("sitemap.xml");
		expect(xmlFile.type).toBe(FileType.DATA);
		expect(xmlFile.format).toBe(DataFormat.XML);
		
		const csvFile = FileTypeRegistry.classify("data.csv");
		expect(csvFile.type).toBe(FileType.DATA);
		expect(csvFile.format).toBe(DataFormat.CSV);
		
		const tomlFile = FileTypeRegistry.classify("pyproject.toml");
		expect(tomlFile.type).toBe(FileType.DATA);
		expect(tomlFile.format).toBe(DataFormat.TOML);
		
		const sqlFile = FileTypeRegistry.classify("schema.sql");
		expect(sqlFile.type).toBe(FileType.DATA);
		expect(sqlFile.format).toBe(DataFormat.SQL);
	});
	
	test("should classify text files correctly", () => {
		const mdFile = FileTypeRegistry.classify("README.md");
		expect(mdFile.type).toBe(FileType.TEXT);
		expect(mdFile.isBinary).toBe(false);
		expect(mdFile.isTextEditable).toBe(true);
		
		const txtFile = FileTypeRegistry.classify("notes.txt");
		expect(txtFile.type).toBe(FileType.TEXT);
	});
	
	test("should classify binary files correctly", () => {
		const exeFile = FileTypeRegistry.classify("app.exe");
		expect(exeFile.type).toBe(FileType.BINARY);
		expect(exeFile.isBinary).toBe(true);
		expect(exeFile.isTextEditable).toBe(false);
		
		const jpgFile = FileTypeRegistry.classify("photo.jpg");
		expect(jpgFile.type).toBe(FileType.BINARY);
		expect(jpgFile.isBinary).toBe(true);
		
		const zipFile = FileTypeRegistry.classify("archive.zip");
		expect(zipFile.type).toBe(FileType.BINARY);
	});
	
	test("should handle special filenames correctly", () => {
		const dockerfile = FileTypeRegistry.classify("Dockerfile");
		expect(dockerfile.type).toBe(FileType.CONFIG);
		
		const makefile = FileTypeRegistry.classify("Makefile");
		expect(makefile.type).toBe(FileType.CONFIG);
		
		const cargoToml = FileTypeRegistry.classify("Cargo.toml");
		expect(cargoToml.type).toBe(FileType.CONFIG);
		expect(cargoToml.format).toBe(DataFormat.TOML);
		
		const packageJson = FileTypeRegistry.classify("package.json");
		expect(packageJson.type).toBe(FileType.CONFIG);
		expect(packageJson.format).toBe(DataFormat.JSON);
		
		const tsconfig = FileTypeRegistry.classify("tsconfig.json");
		expect(tsconfig.type).toBe(FileType.CONFIG);
		expect(tsconfig.format).toBe(DataFormat.JSON);
		
		const envFile = FileTypeRegistry.classify(".env.local");
		expect(envFile.type).toBe(FileType.CONFIG);
	});
	
	test("should handle unknown files with reasonable defaults", () => {
		const unknownFile = FileTypeRegistry.classify("weird.xyz");
		expect(unknownFile.type).toBe(FileType.TEXT);
		expect(unknownFile.extension).toBe(".xyz");
		expect(unknownFile.confidence).toBe(0.5);
		expect(unknownFile.isBinary).toBe(false);
		expect(unknownFile.isTextEditable).toBe(true);
	});
	
	test("should provide convenience methods", () => {
		expect(FileTypeRegistry.isCode("script.py")).toBe(true);
		expect(FileTypeRegistry.isCode("config.json")).toBe(false);
		
		expect(FileTypeRegistry.isStructuredData("config.json")).toBe(true);
		expect(FileTypeRegistry.isStructuredData("script.py")).toBe(false);
		
		expect(FileTypeRegistry.isTextEditable("README.md")).toBe(true);
		expect(FileTypeRegistry.isTextEditable("photo.jpg")).toBe(false);
		
		expect(FileTypeRegistry.isBinary("app.exe")).toBe(true);
		expect(FileTypeRegistry.isBinary("script.js")).toBe(false);
	});
	
	test("should get language correctly", () => {
		expect(FileTypeRegistry.getLanguage("app.ts")).toBe(CodeLanguage.TYPESCRIPT);
		expect(FileTypeRegistry.getLanguage("script.py")).toBe(CodeLanguage.PYTHON);
		expect(FileTypeRegistry.getLanguage("config.json")).toBe(CodeLanguage.UNKNOWN);
	});
	
	test("should get data format correctly", () => {
		expect(FileTypeRegistry.getDataFormat("config.json")).toBe(DataFormat.JSON);
		expect(FileTypeRegistry.getDataFormat("deploy.yaml")).toBe(DataFormat.YAML);
		expect(FileTypeRegistry.getDataFormat("script.py")).toBe(DataFormat.UNKNOWN);
	});
	
	test("should list supported languages and formats", () => {
		const languages = FileTypeRegistry.getSupportedLanguages();
		expect(languages).toContain(CodeLanguage.TYPESCRIPT);
		expect(languages).toContain(CodeLanguage.PYTHON);
		expect(languages).not.toContain(CodeLanguage.UNKNOWN);
		
		const formats = FileTypeRegistry.getSupportedDataFormats();
		expect(formats).toContain(DataFormat.JSON);
		expect(formats).toContain(DataFormat.YAML);
		expect(formats).not.toContain(DataFormat.UNKNOWN);
	});
	
	test("should allow custom registrations", () => {
		// Register custom extension
		FileTypeRegistry.registerExtension('.custom', {
			type: FileType.CODE,
			language: CodeLanguage.UNKNOWN,
			confidence: 0.8
		});
		
		const customFile = FileTypeRegistry.classify("test.custom");
		expect(customFile.type).toBe(FileType.CODE);
		expect(customFile.confidence).toBe(0.8);
		
		// Register custom pattern - need a pattern that won't match existing ones
		FileTypeRegistry.registerPattern(/^CUSTOM_BUILD_FILE$/i, {
			type: FileType.CONFIG,
			confidence: 0.9
		});
		
		const buildFile = FileTypeRegistry.classify("CUSTOM_BUILD_FILE");
		expect(buildFile.type).toBe(FileType.CONFIG);
		expect(buildFile.confidence).toBe(0.9);
	});
	
	test("should handle case insensitivity correctly", () => {
		const upperTs = FileTypeRegistry.classify("Component.TS");
		expect(upperTs.type).toBe(FileType.CODE);
		expect(upperTs.language).toBe(CodeLanguage.TYPESCRIPT);
		
		const mixedCase = FileTypeRegistry.classify("Config.JSON");
		expect(mixedCase.type).toBe(FileType.DATA);
		expect(mixedCase.format).toBe(DataFormat.JSON);
	});
	
	test("should detect binary heuristically", () => {
		// Test unknown extensions that look binary
		const unknownBin = FileTypeRegistry.classify("data.bin");
		expect(unknownBin.isBinary).toBe(true);
		
		// Test special binary filenames
		const coreFile = FileTypeRegistry.classify("core");
		expect(coreFile.isBinary).toBe(true);
		
		const dsStore = FileTypeRegistry.classify(".DS_Store");
		expect(dsStore.isBinary).toBe(true);
	});
});