import pytest
from unittest.mock import MagicMock
from retrieval.reranker import CrossEncoderReranker


class TestReranker:
    def test_reranker_empty_candidates(self):
        reranker = CrossEncoderReranker()
        assert reranker.rerank("some query", []) == []

    def test_reranker_fallback_when_model_none(self):
        reranker = CrossEncoderReranker()
        reranker._initialized = True
        reranker._model = None  # simulate model load failure

        candidates = [
            {"problem_id": "1", "title": "A", "score": 0.5},
            {"problem_id": "2", "title": "B", "score": 0.8},
        ]
        results = reranker.rerank("query", candidates, top_k=1)
        assert len(results) == 1
        assert results[0]["problem_id"] == "1"

    def test_reranker_scoring_and_sorting(self):
        reranker = CrossEncoderReranker()
        reranker._initialized = True

        mock_model = MagicMock()
        # candidate 0 gets score 1.2, candidate 1 gets score 5.6
        mock_model.predict.return_value = [1.2, 5.6]
        reranker._model = mock_model

        candidates = [
            {"problem_id": "1", "title": "A", "topics": ["Tree"], "text": "desc A", "score": 0.5},
            {"problem_id": "2", "title": "B", "topics": ["Graph"], "text": "desc B", "score": 0.3},
        ]

        results = reranker.rerank("graph query", candidates, top_k=2)
        assert len(results) == 2
        # Highest rerank_score should come first
        assert results[0]["problem_id"] == "2"
        assert results[0]["rerank_score"] == 5.6
        assert results[1]["problem_id"] == "1"
        assert results[1]["rerank_score"] == 1.2
