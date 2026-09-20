import pytest
from retrieval.query_modifier import (
    clean_search_query,
    detect_difficulty,
    detect_topics,
    modify_query,
)


class TestQueryModifier:
    def test_detect_difficulty(self):
        assert detect_difficulty("easy two sum problem") == "Easy"
        assert detect_difficulty("how to solve this medium dynamic programming problem?") == "Medium"
        assert detect_difficulty("a very hard graph problem") == "Hard"
        assert detect_difficulty("just binary search") is None

    def test_detect_topics(self):
        # Single topic
        topics = detect_topics("explain binary search on a sorted array")
        assert "Binary Search" in topics
        assert "Array" in topics

        # Aliases
        dp_topics = detect_topics("how to solve with memoization and dp")
        assert "Dynamic Programming" in dp_topics

        heap_topics = detect_topics("using priority queue to find min")
        assert "Heap (Priority Queue)" in heap_topics

        two_pointers = detect_topics("two pointer technique")
        assert "Two Pointers" in two_pointers

    def test_clean_search_query(self):
        # Conversational prefixes
        assert clean_search_query("Explain the Shortest Path in Binary Matrix problem.") == "Shortest Path in Binary Matrix"
        assert clean_search_query("How can I solve the problem of random pick with blacklist?") == "random pick with blacklist"
        assert clean_search_query("How would you explain the solution for Two Sum in a technical interview?") == "Two Sum"
        assert clean_search_query("I want to understand the main idea and algorithm used for merge intervals.") == "merge intervals"

    def test_modify_query_structure(self):
        result = modify_query("Explain the Shortest Path in Binary Matrix problem.")
        assert "original_query" in result
        assert "cleaned_query" in result
        assert "modified_query" in result
        assert "difficulty" in result
        assert "topic" in result
        assert "topics" in result
        assert result["cleaned_query"] == "Shortest Path in Binary Matrix"
        assert result["modified_query"] == result["cleaned_query"]
