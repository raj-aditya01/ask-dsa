/**
 * Hybrid Retriever Service (faithful port of retrieval/hybrid_retriever.py)
 * Multi-Field BM25 + Semantic Candidate Generation + RRF + Cross-Relevance Reranker
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { classifyQuery } = require('./adaptiveRag');
const { BM25Okapi, tokenize } = require('./bm25');

class HybridRetriever {
  constructor(chunksPath = config.CHUNKS_PATH) {
    this.chunksPath = chunksPath;
    this.chunks = [];
    this.bm25Title = null;
    this.bm25Body = null;
    this.initialized = false;
    this._init();
  }

  _init() {
    if (this.initialized) return;

    if (fs.existsSync(this.chunksPath)) {
      try {
        const raw = fs.readFileSync(this.chunksPath, 'utf8');
        this.chunks = JSON.parse(raw);
        console.log(`[HybridRetriever] Loaded ${this.chunks.length} chunks from ${this.chunksPath}`);
      } catch (e) {
        console.error(`[HybridRetriever] Error loading chunks from ${this.chunksPath}:`, e.message);
        this.chunks = [];
      }
    } else {
      console.warn(`[HybridRetriever] Chunks file not found at ${this.chunksPath}`);
      this.chunks = [];
    }

    if (this.chunks.length > 0) {
      const titleTokens = this.chunks.map((c) => tokenize(c.title || ''));
      const bodyTokens = this.chunks.map((c) => tokenize(c.text || ''));

      this.bm25Title = new BM25Okapi(titleTokens);
      this.bm25Body = new BM25Okapi(bodyTokens);
    }

    this.initialized = true;
  }

  setChunks(chunks) {
    if (!chunks || chunks.length === 0) return;
    this.chunks = chunks;
    const titleTokens = this.chunks.map((c) => tokenize(c.title || ''));
    const bodyTokens = this.chunks.map((c) => tokenize(c.text || ''));
    this.bm25Title = new BM25Okapi(titleTokens);
    this.bm25Body = new BM25Okapi(bodyTokens);
    this.initialized = true;
  }

  _bm25MultiFieldSearch(query, cleanedQuery, candidateK = 40) {
    if (!this.bm25Title || !this.bm25Body || this.chunks.length === 0) {
      return [];
    }

    const queryTokens = tokenize(query);
    const cleanedTokens = tokenize(cleanedQuery);
    const tokensToSearch = cleanedTokens.length > 0 ? cleanedTokens : queryTokens;

    if (tokensToSearch.length === 0) {
      return [];
    }

    const titleScores = this.bm25Title.getScores(tokensToSearch);
    const bodyScores = this.bm25Body.getScores(tokensToSearch);
    const cleanedQueryNormalized = cleanedTokens.join(' ').trim();

    const scored = [];

    for (let i = 0; i < this.chunks.length; i++) {
      const tScore = titleScores[i];
      const bScore = bodyScores[i];

      // Weighted multi-field score (3.5x title + 1.0x body)
      let score = 3.5 * tScore + 1.0 * bScore;

      const chunk = this.chunks[i];
      const chunkTitleLower = (chunk.title || '').toLowerCase().trim();

      // Exact title or strong substring matching bonus
      if (cleanedQueryNormalized && chunkTitleLower) {
        if (chunkTitleLower === cleanedQueryNormalized) {
          score += 50.0; // Massive boost for exact title match
        } else if (
          chunkTitleLower.includes(cleanedQueryNormalized) ||
          cleanedQueryNormalized.includes(chunkTitleLower)
        ) {
          score += 20.0; // Substring match boost
        }
      }

      if (score > 0) {
        scored.push({ idx: i, score });
      }
    }

    // Sort descending by combined score
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, candidateK);
  }

  _semanticCandidateSearch(query, candidateK = 40) {
    if (this.chunks.length === 0) return [];
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored = [];
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      let matchCount = 0;
      const topics = Array.isArray(chunk.topics) ? chunk.topics : [];
      const topicTokens = tokenize(topics.join(' '));
      const categoryTokens = tokenize(chunk.category || '');
      const titleTokens = tokenize(chunk.title || '');

      for (const t of queryTokens) {
        if (titleTokens.includes(t)) matchCount += 3.0;
        if (topicTokens.includes(t)) matchCount += 1.5;
        if (categoryTokens.includes(t)) matchCount += 0.5;
      }

      if (matchCount > 0) {
        scored.push({ idx: i, score: matchCount });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, candidateK);
  }

  _reciprocalRankFusion(bm25Hits, semanticHits, k = 60) {
    const scores = new Map();
    const payloads = new Map();
    const seenPidsBm25 = new Set();
    const seenPidsSem = new Set();

    // 1. Process BM25 Hits (deduplicating chunks per problem to avoid score dilution)
    for (let rank = 1; rank <= bm25Hits.length; rank++) {
      const { idx } = bm25Hits[rank - 1];
      const chunk = this.chunks[idx];
      const pid = String(chunk.problem_id);
      if (!seenPidsBm25.has(pid)) {
        seenPidsBm25.add(pid);
        scores.set(pid, (scores.get(pid) || 0) + 1.2 / (k + rank));
      }
      if (!payloads.has(pid)) {
        payloads.set(pid, chunk);
      }
    }

    // 2. Process Semantic Hits
    for (let rank = 1; rank <= semanticHits.length; rank++) {
      const { idx } = semanticHits[rank - 1];
      const chunk = this.chunks[idx];
      const pid = String(chunk.problem_id);
      if (!seenPidsSem.has(pid)) {
        seenPidsSem.add(pid);
        scores.set(pid, (scores.get(pid) || 0) + 1.0 / (k + rank));
      }
      if (!payloads.has(pid)) {
        payloads.set(pid, chunk);
      }
    }

    const sortedPids = [...scores.keys()].sort((a, b) => scores.get(b) - scores.get(a));

    const candidates = [];
    for (const pid of sortedPids) {
      const doc = payloads.get(pid);
      candidates.push({
        problem_id: pid,
        title: doc.title || '',
        difficulty: doc.difficulty || '',
        category: doc.category || '',
        topics: Array.isArray(doc.topics) ? doc.topics : [],
        text: doc.text || '',
        score: scores.get(pid),
      });
    }

    return candidates;
  }

  _rerankCandidates(query, cleanedQuery, candidates, topK = 5) {
    if (!candidates || candidates.length === 0) return [];

    const queryTokens = new Set(tokenize(query));
    const cleanedLower = (cleanedQuery || query).toLowerCase().trim();

    const reranked = candidates.map((doc) => {
      let score = doc.score || 0;
      const titleLower = (doc.title || '').toLowerCase().trim();
      const titleTokens = tokenize(doc.title);
      const textPreviewTokens = tokenize((doc.text || '').slice(0, 600));

      let rerankScore = score * 10;

      // Exact title match bonus
      if (titleLower === cleanedLower) {
        rerankScore += 100.0;
      } else if (titleLower.includes(cleanedLower) || cleanedLower.includes(titleLower)) {
        rerankScore += 30.0;
      }

      // Keyword overlap
      let overlapCount = 0;
      for (const t of queryTokens) {
        if (titleTokens.includes(t)) overlapCount += 3;
        if (textPreviewTokens.includes(t)) overlapCount += 1;
      }

      rerankScore += overlapCount;

      return {
        ...doc,
        rerank_score: parseFloat(rerankScore.toFixed(4)),
      };
    });

    reranked.sort((a, b) => b.rerank_score - a.rerank_score);
    return reranked.slice(0, topK);
  }

  retrieve(query, topK = null) {
    const routing = classifyQuery(query);
    const cleanedQuery = routing.cleaned_query;
    const originalQuery = routing.original_query;
    const finalTopK = topK || routing.top_k;
    const candidateK = routing.candidate_k;

    // Step 1: Candidate Generation (BM25 + Semantic)
    const bm25Hits = this._bm25MultiFieldSearch(originalQuery, cleanedQuery, candidateK);
    const semanticHits = this._semanticCandidateSearch(cleanedQuery || originalQuery, candidateK);

    // Step 2: Reciprocal Rank Fusion
    const candidates = this._reciprocalRankFusion(bm25Hits, semanticHits, 60);

    // Step 3: Semantic Reranking
    const finalResults = this._rerankCandidates(
      originalQuery,
      cleanedQuery,
      candidates,
      finalTopK
    );

    return {
      routing,
      results: finalResults,
    };
  }
}

let retrieverInstance = null;

function getRetriever() {
  if (!retrieverInstance) {
    retrieverInstance = new HybridRetriever();
  }
  return retrieverInstance;
}

module.exports = {
  HybridRetriever,
  getRetriever,
};
