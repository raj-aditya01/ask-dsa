import pytest
from retrieval.display import print_results


class TestDisplay:
    def test_print_results_empty(self, capsys):
        response = {
            "routing": {
                "original_query": "unknown topic",
                "cleaned_query": "unknown topic",
                "difficulty": None,
                "topic": None,
                "strategy": "specific_qa",
                "use_hybrid": True,
                "use_mmr": False,
            },
            "results": [],
        }
        print_results(response)
        captured = capsys.readouterr().out
        assert "QUERY ROUTING" in captured
        assert "No results found." in captured

    def test_print_results_with_items(self, capsys):
        response = {
            "routing": {
                "original_query": "How to solve Two Sum?",
                "cleaned_query": "Two Sum",
                "difficulty": "Easy",
                "topic": "Array",
                "strategy": "specific_qa",
                "use_hybrid": True,
                "use_mmr": False,
            },
            "results": [
                {
                    "problem_id": "1",
                    "title": "Two Sum",
                    "difficulty": "Easy",
                    "category": "Algorithms",
                    "topics": ["Array", "Hash Table"],
                    "rerank_score": 6.81234,
                    "text": "Given an array of integers nums and an integer target...",
                }
            ],
        }
        print_results(response)
        captured = capsys.readouterr().out
        assert "Two Sum" in captured
        assert "Easy" in captured
        assert "6.81234" in captured
        assert "Problem ID: 1" in captured

    def test_print_results_backward_compatible_modified_query(self, capsys):
        # Even if only modified_query is in routing
        response = {
            "routing": {
                "original_query": "two sum",
                "modified_query": "two sum",
            },
            "results": [
                {
                    "problem_id": "1",
                    "title": "Two Sum",
                    "score": 0.045,
                    "text": "sample text",
                }
            ],
        }
        print_results(response)
        captured = capsys.readouterr().out
        assert "Two Sum" in captured
        assert "0.045" in captured
