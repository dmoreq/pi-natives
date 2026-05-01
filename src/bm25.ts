// ── Types ───────────────────────────────────────────────────────────

export interface Bm25Document {
	id: string;
	text: string;
}

export interface Bm25Match {
	id: string;
	score: number;
}

export interface Bm25IndexOptions {
	/** Term frequency saturation parameter (default: 1.5). */
	k1?: number;
	/** Length normalization parameter (default: 0.75). */
	b?: number;
}

// ── Tokenizer ──────────────────────────────────────────────────────

/**
 * Simple word tokenizer: lowercases, splits on non-alphanumeric chars,
 * filters tokens shorter than 2 characters.
 */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9_]+/)
		.filter(t => t.length >= 2);
}

// ── BM25 Index ─────────────────────────────────────────────────────

export class Bm25Index {
	#documents: Bm25Document[];
	#k1: number;
	#b: number;

	/** Document id → term → frequency. */
	#termFreqs: Map<string, Map<string, number>>;
	/** Term → number of documents containing it. */
	#docFreqs: Map<string, number>;
	/** Document id → total token count. */
	#docLengths: Map<string, number>;
	/** Average document length. */
	#avgDocLength: number;
	/** Total number of documents. */
	#numDocs: number;

	constructor(k1 = 1.5, b = 0.75) {
		this.#documents = [];
		this.#k1 = k1;
		this.#b = b;
		this.#termFreqs = new Map();
		this.#docFreqs = new Map();
		this.#docLengths = new Map();
		this.#avgDocLength = 0;
		this.#numDocs = 0;
	}

	/**
	 * Add a document to the index. If a document with the same id already
	 * exists, it is replaced.
	 */
	addDocument(doc: Bm25Document): void {
		const existingIdx = this.#documents.findIndex(d => d.id === doc.id);
		if (existingIdx >= 0) {
			this.#removeDocument(doc.id);
		}

		this.#documents.push(doc);
		this.#indexDocument(doc);
		this.#recomputeAvgDocLength();
	}

	/**
	 * Index a document's tokens without modifying the document list or
	 * recomputing average document length. Shared by addDocument and addDocuments.
	 */
	#indexDocument(doc: Bm25Document): void {
		const tokens = tokenize(doc.text);
		const termFreq = new Map<string, number>();
		const seenTerms = new Set<string>();

		for (const token of tokens) {
			termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
			if (!seenTerms.has(token)) {
				seenTerms.add(token);
				this.#docFreqs.set(token, (this.#docFreqs.get(token) ?? 0) + 1);
			}
		}

		this.#termFreqs.set(doc.id, termFreq);
		this.#docLengths.set(doc.id, tokens.length);
	}

	/**
	 * Recompute the average document length from all stored documents.
	 */
	#recomputeAvgDocLength(): void {
		this.#numDocs = this.#documents.length;

		let totalLength = 0;
		for (const len of this.#docLengths.values()) {
			totalLength += len;
		}
		this.#avgDocLength = this.#numDocs > 0 ? totalLength / this.#numDocs : 0;
	}

	/**
	 * Add multiple documents at once.
	 * Optimized to recompute average document length only once after all docs are indexed.
	 */
	addDocuments(docs: Bm25Document[]): void {
		if (docs.length === 0) return;

		for (const doc of docs) {
			// Remove existing document with same id before re-adding
			const existingIdx = this.#documents.findIndex(d => d.id === doc.id);
			if (existingIdx >= 0) {
				this.#removeDocument(doc.id);
			}
			this.#documents.push(doc);
			this.#indexDocument(doc);
		}
		this.#recomputeAvgDocLength();
	}

	/**
	 * Remove a document by id.
	 */
	#removeDocument(id: string): void {
		const idx = this.#documents.findIndex(d => d.id === id);
		if (idx < 0) return;

		this.#documents.splice(idx, 1);
		const termFreq = this.#termFreqs.get(id);
		if (termFreq) {
			for (const term of termFreq.keys()) {
				const current = this.#docFreqs.get(term) ?? 0;
				if (current <= 1) {
					this.#docFreqs.delete(term);
				} else {
					this.#docFreqs.set(term, current - 1);
				}
			}
		}

		this.#termFreqs.delete(id);
		this.#docLengths.delete(id);
		this.#numDocs = this.#documents.length;
	}

	/**
	 * Search the index for the given query, returning matches ranked by
	 * BM25 score (descending).
	 */
	search(query: string, topK = 10): Bm25Match[] {
		if (this.#numDocs === 0) return [];

		const queryTokens = tokenize(query);
		if (queryTokens.length === 0) return [];

		// Deduplicate query tokens
		const uniqueQueryTokens = [...new Set(queryTokens)];

		const scores = new Map<string, number>();

		for (const [docId, doc] of this.#documents.entries()) {
			const termFreq = this.#termFreqs.get(doc.id);
			if (!termFreq) continue;

			const docLength = this.#docLengths.get(doc.id) ?? 0;
			let score = 0;

			for (const term of uniqueQueryTokens) {
				const tf = termFreq.get(term) ?? 0;
				if (tf === 0) continue;

				const df = this.#docFreqs.get(term) ?? 0;
				const idf = Math.log((this.#numDocs - df + 0.5) / (df + 0.5) + 1);
				const numerator = tf * (this.#k1 + 1);
				const denominator = tf + this.#k1 * (1 - this.#b + this.#b * (docLength / this.#avgDocLength));
				score += idf * (numerator / denominator);
			}

			if (score > 0) {
				scores.set(doc.id, score);
			}
		}

		// Sort by score descending
		return [...scores.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, topK)
			.map(([id, score]) => ({ id, score: Math.round(score * 1_000_000) / 1_000_000 }));
	}

	/**
	 * Get the number of documents in the index.
	 */
	get documentCount(): number {
		return this.#numDocs;
	}

	/**
	 * Clear all documents from the index.
	 */
	clear(): void {
		this.#documents = [];
		this.#termFreqs.clear();
		this.#docFreqs.clear();
		this.#docLengths.clear();
		this.#avgDocLength = 0;
		this.#numDocs = 0;
	}
}
