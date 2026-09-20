import pytest
from retrieval.adaptive_rag import classify_query


class TestAdaptiveRAG:
    def test_specific_qa_routing(self):
        result = classify_query("Explain the Two Sum problem.")
        assert result["strategy"] == "specific_qa"
        assert result["use_mmr"] is False
        assert result["top_k"] == 5
        assert result["candidate_k"] == 40
        assert result["cleaned_query"] == "Two Sum"

    def test_exploratory_routing(self):
        # Query with "give me 5"
        result1 = classify_query("give me 5 dynamic programming problems")
        assert result1["strategy"] == "exploratory"
        assert result1["use_mmr"] is True
        assert result1["top_k"] == 8

        # Query with "compare ... vs"
        result2 = classify_query("compare bfs vs dfs approaches")
        assert result2["strategy"] == "exploratory"
        assert result2["use_mmr"] is True

        # Query with "different problems"
        result3 = classify_query("different sliding window problems")
        assert result3["strategy"] == "exploratory"
        assert result3["use_mmr"] is True
