/**
 * File type registry for unified language/extension detection
 * 
 * Centralizes file type detection logic that was previously scattered
 * across multiple modules, eliminating DRY violations.
 */

import { extname, basename } from "node:path";

/**
 * File type classification
 */
export enum FileType {
	CODE = 'code',
	DATA = 'data', 
	TEXT = 'text',
	BINARY = 'binary',
	CONFIG = 'config'
}

/**
 * Programming language identification
 */
export enum CodeLanguage {
	TYPESCRIPT = 'typescript',
	JAVASCRIPT = 'javascript',
	TSX = 'tsx',
	JSX = 'jsx', 
	PYTHON = 'python',
	RUST = 'rust',
	GO = 'go',
	JAVA = 'java',
	CSHARP = 'csharp',
	KOTLIN = 'kotlin',
	C = 'c',
	CPP = 'cpp',
	PHP = 'php',
	RUBY = 'ruby',
	SWIFT = 'swift',
	SCALA = 'scala',
	UNKNOWN = 'unknown'
}

/**
 * Data format identification
 */
export enum DataFormat {
	JSON = 'json',
	YAML = 'yaml',
	XML = 'xml',
	CSV = 'csv',
	TOML = 'toml',
	SQL = 'sql',
	PROTOBUF = 'protobuf',
	UNKNOWN = 'unknown'
}

/**
 * Complete file classification result
 */
export interface FileClassification {
	/** High-level file type */
	type: FileType;
	
	/** Programming language (for code files) */
	language?: CodeLanguage;
	
	/** Data format (for data files) */
	format?: DataFormat;
	
	/** File extension */
	extension: string;
	
	/** Confidence level (0-1) */
	confidence: number;
	
	/** Whether file is likely binary */
	isBinary: boolean;
	
	/** Whether file can be edited as text */
	isTextEditable: boolean;
}

/**
 * Extension mapping configuration
 */
interface ExtensionMapping {
	type: FileType;
	language?: CodeLanguage;
	format?: DataFormat;
	aliases?: string[]; // Alternative extensions
	confidence?: number; // Default 1.0
}

/**
 * Unified file type registry
 */
export class FileTypeRegistry {
	private static extensionMap = new Map<string, ExtensionMapping>([
		// TypeScript & JavaScript
		['.ts', { type: FileType.CODE, language: CodeLanguage.TYPESCRIPT }],
		['.tsx', { type: FileType.CODE, language: CodeLanguage.TSX }],
		['.js', { type: FileType.CODE, language: CodeLanguage.JAVASCRIPT }],
		['.jsx', { type: FileType.CODE, language: CodeLanguage.JSX }],
		['.mjs', { type: FileType.CODE, language: CodeLanguage.JAVASCRIPT }],
		['.cjs', { type: FileType.CODE, language: CodeLanguage.JAVASCRIPT }],
		
		// Python
		['.py', { type: FileType.CODE, language: CodeLanguage.PYTHON }],
		['.pyi', { type: FileType.CODE, language: CodeLanguage.PYTHON }],
		['.pyw', { type: FileType.CODE, language: CodeLanguage.PYTHON }],
		
		// Systems languages
		['.rs', { type: FileType.CODE, language: CodeLanguage.RUST }],
		['.go', { type: FileType.CODE, language: CodeLanguage.GO }],
		['.c', { type: FileType.CODE, language: CodeLanguage.C }],
		['.h', { type: FileType.CODE, language: CodeLanguage.C }],
		['.cpp', { type: FileType.CODE, language: CodeLanguage.CPP }],
		['.cxx', { type: FileType.CODE, language: CodeLanguage.CPP }],
		['.cc', { type: FileType.CODE, language: CodeLanguage.CPP }],
		['.hpp', { type: FileType.CODE, language: CodeLanguage.CPP }],
		
		// JVM languages  
		['.java', { type: FileType.CODE, language: CodeLanguage.JAVA }],
		['.kt', { type: FileType.CODE, language: CodeLanguage.KOTLIN }],
		['.kts', { type: FileType.CODE, language: CodeLanguage.KOTLIN }],
		['.scala', { type: FileType.CODE, language: CodeLanguage.SCALA }],
		
		// Other languages
		['.cs', { type: FileType.CODE, language: CodeLanguage.CSHARP }],
		['.php', { type: FileType.CODE, language: CodeLanguage.PHP }],
		['.rb', { type: FileType.CODE, language: CodeLanguage.RUBY }],
		['.swift', { type: FileType.CODE, language: CodeLanguage.SWIFT }],
		
		// Data formats
		['.json', { type: FileType.DATA, format: DataFormat.JSON }],
		['.yaml', { type: FileType.DATA, format: DataFormat.YAML }],
		['.yml', { type: FileType.DATA, format: DataFormat.YAML }],
		['.xml', { type: FileType.DATA, format: DataFormat.XML }],
		['.csv', { type: FileType.DATA, format: DataFormat.CSV }],
		['.tsv', { type: FileType.DATA, format: DataFormat.CSV }],
		['.toml', { type: FileType.DATA, format: DataFormat.TOML }],
		['.sql', { type: FileType.DATA, format: DataFormat.SQL }],
		['.proto', { type: FileType.DATA, format: DataFormat.PROTOBUF }],
		
		// Text files
		['.md', { type: FileType.TEXT }],
		['.txt', { type: FileType.TEXT }],
		['.rst', { type: FileType.TEXT }],
		['.adoc', { type: FileType.TEXT }],
		
		// Config files
		['.config', { type: FileType.CONFIG }],
		['.conf', { type: FileType.CONFIG }],
		['.ini', { type: FileType.CONFIG }],
		['.env', { type: FileType.CONFIG }],
		['.gitignore', { type: FileType.CONFIG }],
		['.dockerignore', { type: FileType.CONFIG }],
		
		// Binary (common extensions)
		['.exe', { type: FileType.BINARY }],
		['.dll', { type: FileType.BINARY }],
		['.so', { type: FileType.BINARY }],
		['.dylib', { type: FileType.BINARY }],
		['.bin', { type: FileType.BINARY }],
		['.zip', { type: FileType.BINARY }],
		['.tar', { type: FileType.BINARY }],
		['.gz', { type: FileType.BINARY }],
		['.pdf', { type: FileType.BINARY }],
		['.jpg', { type: FileType.BINARY }],
		['.jpeg', { type: FileType.BINARY }],
		['.png', { type: FileType.BINARY }],
		['.gif', { type: FileType.BINARY }],
		['.mp3', { type: FileType.BINARY }],
		['.mp4', { type: FileType.BINARY }],
		['.avi', { type: FileType.BINARY }]
	]);
	
	/**
	 * Special filename patterns
	 */
	private static filenamePatterns = new Map<RegExp, ExtensionMapping>([
		// Config files without extensions
		[/^Dockerfile$/i, { type: FileType.CONFIG }],
		[/^Makefile$/i, { type: FileType.CONFIG }],
		[/^Cargo\.toml$/i, { type: FileType.CONFIG, format: DataFormat.TOML }],
		[/^package\.json$/i, { type: FileType.CONFIG, format: DataFormat.JSON }],
		[/^tsconfig.*\.json$/i, { type: FileType.CONFIG, format: DataFormat.JSON }],
		[/^\.env.*$/i, { type: FileType.CONFIG }],
		[/^\..*rc$/i, { type: FileType.CONFIG }],
		
		// Scripts without extensions
		[/^build$/i, { type: FileType.CODE, language: CodeLanguage.UNKNOWN, confidence: 0.7 }],
		[/^install$/i, { type: FileType.CODE, language: CodeLanguage.UNKNOWN, confidence: 0.7 }]
	]);
	
	/**
	 * Classify a file by its path
	 */
	static classify(filePath: string): FileClassification {
		const extension = extname(filePath).toLowerCase();
		const filename = basename(filePath);
		
		// Check filename patterns first (higher priority for special files)
		for (const [pattern, mapping] of this.filenamePatterns) {
			if (pattern.test(filename)) {
				return this.buildClassification(filePath, mapping, extension);
			}
		}
		
		// Check extension mapping
		const extensionMapping = this.extensionMap.get(extension);
		if (extensionMapping) {
			return this.buildClassification(filePath, extensionMapping);
		}
		
		// Default classification
		const isBinary = this.isLikelyBinary(filePath);
		return {
			type: isBinary ? FileType.BINARY : FileType.TEXT,
			extension,
			confidence: 0.5, // Low confidence for unknown files
			isBinary,
			isTextEditable: !isBinary
		};
	}
	
	/**
	 * Get language for a code file
	 */
	static getLanguage(filePath: string): CodeLanguage {
		const classification = this.classify(filePath);
		return classification.language || CodeLanguage.UNKNOWN;
	}
	
	/**
	 * Get data format for a data file
	 */
	static getDataFormat(filePath: string): DataFormat {
		const classification = this.classify(filePath);
		return classification.format || DataFormat.UNKNOWN;
	}
	
	/**
	 * Check if file is likely code
	 */
	static isCode(filePath: string): boolean {
		return this.classify(filePath).type === FileType.CODE;
	}
	
	/**
	 * Check if file is structured data
	 */
	static isStructuredData(filePath: string): boolean {
		return this.classify(filePath).type === FileType.DATA;
	}
	
	/**
	 * Check if file can be edited as text
	 */
	static isTextEditable(filePath: string): boolean {
		return this.classify(filePath).isTextEditable;
	}
	
	/**
	 * Check if file is likely binary
	 */
	static isBinary(filePath: string): boolean {
		return this.classify(filePath).isBinary;
	}
	
	/**
	 * Get all supported code languages
	 */
	static getSupportedLanguages(): CodeLanguage[] {
		return Object.values(CodeLanguage).filter(lang => lang !== CodeLanguage.UNKNOWN);
	}
	
	/**
	 * Get all supported data formats
	 */
	static getSupportedDataFormats(): DataFormat[] {
		return Object.values(DataFormat).filter(fmt => fmt !== DataFormat.UNKNOWN);
	}
	
	/**
	 * Register custom file type mapping
	 */
	static registerExtension(
		extension: string, 
		mapping: ExtensionMapping
	): void {
		this.extensionMap.set(extension.toLowerCase(), mapping);
	}
	
	/**
	 * Register custom filename pattern
	 */
	static registerPattern(
		pattern: RegExp, 
		mapping: ExtensionMapping
	): void {
		this.filenamePatterns.set(pattern, mapping);
	}
	
	/**
	 * Build complete classification from mapping
	 */
	private static buildClassification(
		filePath: string,
		mapping: ExtensionMapping,
		extension?: string
	): FileClassification {
		const ext = extension || extname(filePath).toLowerCase();
		const isBinary = mapping.type === FileType.BINARY;
		
		return {
			type: mapping.type,
			language: mapping.language,
			format: mapping.format,
			extension: ext,
			confidence: mapping.confidence || 1.0,
			isBinary,
			isTextEditable: !isBinary
		};
	}
	
	/**
	 * Heuristic check for binary files
	 */
	private static isLikelyBinary(filePath: string): boolean {
		const extension = extname(filePath).toLowerCase();
		const filename = basename(filePath);
		
		// Known binary extensions
		const binaryExtensions = [
			'.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a',
			'.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
			'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
			'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp',
			'.mp3', '.mp4', '.avi', '.mov', '.wav', '.ogg', '.flac',
			'.woff', '.woff2', '.ttf', '.otf', '.eot'
		];
		
		if (binaryExtensions.includes(extension)) {
			return true;
		}
		
		// Files without extensions that are commonly binary
		const binaryFilenames = /^(a\.out|core|\.DS_Store)$/i;
		if (binaryFilenames.test(filename)) {
			return true;
		}
		
		return false;
	}
}