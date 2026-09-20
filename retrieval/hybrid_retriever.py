import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from rank_bm25 import BM25Okapi

from retrieval.adaptive_rag import classify_query
from retrieval.reranker import CrossEncoderReranker

logger = logging.getLogger("askdsa.retriever")

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)
CHUNKS_PATH = os.path.join(PROJECT_ROOT, "data", "problem_chunks.json")
CHROMA_PATH = os.path.join(PROJECT_ROOT, "chroma_db")
COLLECTION_NAME = "askdsa"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _tokenize(text: str) -> List[str]:
    """Tokenize alphanumeric words in lowercase."""
    return re.findall(r"[a-z0-9]+", str(text).lower())


class HybridRetriever:
    """
    Enterprise Production-Grade Hybrid Retriever for Data Structures and Algorithms.
    
    Architecture:
    1. Multi-Field BM25 (Title-boosted 3.5x + Body 1.0x + Exact Substring Match).
    2. Dense Vector Search (ChromaDB + all-MiniLM-L6-v2 embeddings).
    3. Reciprocal Rank Fusion (RRF) for Candidate Generation (Top 40-50).
    4. Cross-Encoder Reranker (ms-marco-MiniLM-L-6-v2) for High-Precision Top-K Selection.
    """

    def __init__(
        self,
        chunks_path: str = CHUNKS_PATH,
        chroma_path: str = CHROMA_PATH,
        embedding_model: str = EMBEDDING_MODEL,
        enable_reranker: bool = True,
    ):
        logger.info("Initializing HybridRetriever...")
        with open(chunks_path, "r", encoding="utf-8") as file:
            self.chunks: List[Dict[str, Any]] = json.load(file)

        # Pre-build lookup maps
        self.chunk_lookup = {
            (str(chunk["problem_id"]), chunk.get("chunk_id", 0)): chunk
            for chunk in self.chunks
        }
        
        # Pre-compute unique problem metadata map
        self.problem_map = {}
        for chunk in self.chunks:
            pid = str(chunk["problem_id"])
            if pid not in self.problem_map:
                self.problem_map[pid] = chunk

        # Multi-Field BM25 Indices
        title_tokens = [_tokenize(chunk.get("title", "")) for chunk in self.chunks]
        body_tokens = [_tokenize(chunk.get("text", "")) for chunk in self.chunks]
        
        self.bm25_title = BM25Okapi(title_tokens)
        self.bm25_body = BM25Okapi(body_tokens)

        # Dense Vector Store
        self.embeddings = HuggingFaceEmbeddings(
            model_name=embedding_model,
        )
        self.vectorstore = Chroma(
            persist_directory=chroma_path,
            collection_name=COLLECTION_NAME,
            embedding_function=self.embeddings,
        )

        # Cross-Encoder Reranker
        self.enable_reranker = enable_reranker
        self.reranker = CrossEncoderReranker() if enable_reranker else None
        
        logger.info("HybridRetriever initialized successfully with %d chunks.", len(self.chunks))

    def _bm25_multi_field_search(
        self,
        query: str,
        cleaned_query: str,
        candidate_k: int = 40,
    ) -> List[Tuple[int, float]]:
        """
        Multi-Field BM25 search scoring title with 3.5x boost and checking exact title containment.
        """
        query_tokens = _tokenize(query)
        cleaned_tokens = _tokenize(cleaned_query)
        
        tokens_to_search = cleaned_tokens if cleaned_tokens else query_tokens
        if not tokens_to_search:
            return []

        title_scores = self.bm25_title.get_scores(tokens_to_search)
        body_scores = self.bm25_body.get_scores(tokens_to_search)

        cleaned_query_normalized = " ".join(cleaned_tokens).strip()

        combined_scores = np.zeros(len(self.chunks), dtype=float)
        
        for idx, chunk in enumerate(self.chunks):
            t_score = title_scores[idx]
            b_score = body_scores[idx]
            
            # Weighted multi-field score
            score = 3.5 * t_score + 1.0 * b_score
            
            # Exact title or strong substring matching bonus
            chunk_title_lower = chunk.get("title", "").lower().strip()
            if cleaned_query_normalized and chunk_title_lower:
                if chunk_title_lower == cleaned_query_normalized:
                    score += 50.0  # Massive boost for exact title match
                elif chunk_title_lower in cleaned_query_normalized or cleaned_query_normalized in chunk_title_lower:
                    score += 20.0  # Substring match boost
            
            combined_scores[idx] = score

        ranked_indices = np.argsort(combined_scores)[::-1]
        
        results = []
        for idx in ranked_indices:
            if combined_scores[idx] <= 0:
                break
            results.append((idx, float(combined_scores[idx])))
            if len(results) >= candidate_k:
                break

        return results

    def _dense_search(
        self,
        query: str,
        candidate_k: int = 40,
    ) -> List[Tuple[Any, float]]:
        """Dense embedding search over ChromaDB."""
        return self.vectorstore.similarity_search_with_score(
            query,
            k=candidate_k,
        )

    def _reciprocal_rank_fusion(
        self,
        dense_hits: List[Tuple[Any, float]],
        bm25_hits: List[Tuple[int, float]],
        k: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Combines Dense and BM25 candidate lists using Reciprocal Rank Fusion (RRF).
        Returns deduplicated candidates sorted by RRF score.
        """
        scores: Dict[str, float] = {}
        payloads: Dict[str, Dict[str, Any]] = {}

        # 1. Process BM25 Hits
        for rank, (idx, _) in enumerate(bm25_hits, start=1):
            chunk = self.chunks[idx]
            pid = str(chunk["problem_id"])
            scores[pid] = scores.get(pid, 0.0) + (1.2 / (k + rank))
            if pid not in payloads:
                payloads[pid] = chunk

        # 2. Process Dense Hits
        for rank, (doc, _) in enumerate(dense_hits, start=1):
            pid = str(doc.metadata.get("problem_id", ""))
            if not pid:
                continue
            scores[pid] = scores.get(pid, 0.0) + (1.0 / (k + rank))
            if pid not in payloads:
                payloads[pid] = {
                    "problem_id": pid,
                    "title": doc.metadata.get("title", ""),
                    "difficulty": doc.metadata.get("difficulty", ""),
                    "category": doc.metadata.get("category", ""),
                    "topics": doc.metadata.get("topics", "").split(", ") if doc.metadata.get("topics") else [],
                    "text": doc.page_content,
                }

        # Sort combined candidate list
        sorted_pids = sorted(scores.keys(), key=lambda p: scores[p], reverse=True)

        candidates = []
        for pid in sorted_pids:
            doc = payloads[pid]
            candidates.append({
                "problem_id": pid,
                "title": doc.get("title", ""),
                "difficulty": doc.get("difficulty", ""),
                "category": doc.get("category", ""),
                "topics": doc.get("topics", []),
                "text": doc.get("text", ""),
                "score": scores[pid],
            })

        return candidates

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Execute end-to-end hybrid retrieval with cross-encoder reranking.
        """
        routing = classify_query(query)
        cleaned_query = routing["cleaned_query"]
        original_query = routing["original_query"]
        final_top_k = top_k or routing["top_k"]
        candidate_k = routing["candidate_k"]

        # Step 1: Candidate Generation (Dense + Multi-Field BM25)
        bm25_hits = self._bm25_multi_field_search(
            query=original_query,
            cleaned_query=cleaned_query,
            candidate_k=candidate_k,
        )
        dense_hits = self._dense_search(
            query=cleaned_query if cleaned_query else original_query,
            candidate_k=candidate_k,
        )

        # Step 2: Reciprocal Rank Fusion
        candidates = self._reciprocal_rank_fusion(
            dense_hits=dense_hits,
            bm25_hits=bm25_hits,
            k=60,
        )

        # Step 3: Stage-2 Semantic Reranking
        if self.enable_reranker and self.reranker:
            final_results = self.reranker.rerank(
                query=original_query,
                candidates=candidates[:candidate_k],
                top_k=final_top_k,
            )
        else:
            final_results = candidates[:final_top_k]

        return {
            "routing": routing,
            "results": final_results,
        }


# Global singleton instance for high-throughput reuse
_RETRIEVER_INSTANCE: Optional[HybridRetriever] = None


def get_retriever() -> HybridRetriever:
    """Get or create singleton HybridRetriever."""
    global _RETRIEVER_INSTANCE
    if _RETRIEVER_INSTANCE is None:
        _RETRIEVER_INSTANCE = HybridRetriever()
    return _RETRIEVER_INSTANCE


def retrieve(query: str, top_k: int = 5) -> Dict[str, Any]:
    """Convenience functional retrieve interface."""
    retriever = get_retriever()
    return retriever.retrieve(query, top_k=top_k)


if __name__ == "__main__":
    retriever = get_retriever()
    test_queries = [
        "Explain the Shortest Path in Binary Matrix problem.",
        "How can I solve the problem of random pick with blacklist?",
        "Explain the Non-overlapping Intervals problem.",
        "Convert Sorted List to Binary Search Tree",
    ]
    for q in test_queries:
        print("\n" + "=" * 60)
        print("QUERY:", q)
        res = retriever.retrieve(q, top_k=3)
        for r in res["results"]:
            print(f"- ID: {r['problem_id']} | Title: {r['title']} | Score: {r.get('rerank_score', r.get('score')):.4f}")
