import pytest
from unittest.mock import MagicMock
from retrieval.hybrid_retriever import _tokenize, HybridRetriever, get_retriever


class TestHybridRetriever:
    def test_tokenize(self):
        assert _tokenize("Two Sum II - Input Array Is Sorted") == [
            "two", "sum", "ii", "input", "array", "is", "sorted"
        ]
        assert _tokenize("k-th largest element! (Heap)") == [
            "k", "th", "largest", "element", "heap"
        ]

    def test_reciprocal_rank_fusion_logic(self):
        # Create a retriever without loading heavy models for unit test if possible,
        # or test RRF via an instance
        retriever = get_retriever()
        
        # Test mock hits
        dense_hits = []
        bm25_hits = []
        
        candidates = retriever._reciprocal_rank_fusion(dense_hits, bm25_hits)
        assert candidates == []

    def test_retrieve_end_to_end(self):
        retriever = get_retriever()
        response = retriever.retrieve("Two Sum", top_k=3)
        assert "routing" in response
        assert "results" in response
        assert len(response["results"]) > 0

        # Top result for "Two Sum" should be Two Sum (problem ID 1)
        top_result = response["results"][0]
        assert "Two Sum" in top_result["title"]
        assert top_result["problem_id"] == "1"
        assert "rerank_score" in top_result or "score" in top_result
