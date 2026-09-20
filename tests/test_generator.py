import pytest
from unittest.mock import MagicMock
from langchain_core.documents import Document
from langchain_core.messages import AIMessage
from retrieval.generator import DSAGenerator, format_context


class TestGenerator:
    def test_format_context_empty(self):
        assert format_context(None) == "No relevant documents were retrieved."
        assert format_context([]) == "No relevant documents were retrieved."
        assert format_context({"results": []}) == "No relevant documents were retrieved."

    def test_format_context_from_documents(self):
        docs = [
            Document(
                page_content="Given an array of integers nums...",
                metadata={
                    "problem_id": "1",
                    "title": "Two Sum",
                    "difficulty": "Easy",
                    "category": "Algorithms",
                    "topics": "Array, Hash Table",
                },
            )
        ]
        context = format_context(docs)
        assert "Problem ID: 1" in context
        assert "Title: Two Sum" in context
        assert "Difficulty: Easy" in context
        assert "Array, Hash Table" in context
        assert "Given an array of integers nums..." in context

    def test_format_context_from_dicts(self):
        dicts = [
            {
                "problem_id": "141",
                "title": "Linked List Cycle",
                "difficulty": "Easy",
                "category": "Algorithms",
                "topics": ["Linked List", "Two Pointers"],
                "text": "Given head, the head of a linked list...",
            }
        ]
        context = format_context(dicts)
        assert "Problem ID: 141" in context
        assert "Title: Linked List Cycle" in context
        assert "Linked List, Two Pointers" in context

    def test_generator_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="Here is Floyd's algorithm.")

        generator = DSAGenerator(llm=mock_llm)
        response = generator.generate(
            "How to detect a cycle in a linked list?",
            results=[
                {
                    "problem_id": "141",
                    "title": "Linked List Cycle",
                    "difficulty": "Easy",
                    "topics": ["Linked List"],
                    "category": "Algorithms",
                    "text": "Given head...",
                }
            ],
        )

        assert response == "Here is Floyd's algorithm."
        mock_llm.invoke.assert_called_once()

    def test_generator_stream_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.stream.return_value = [
            AIMessage(content="Part 1. "),
            AIMessage(content="Part 2."),
        ]

        generator = DSAGenerator(llm=mock_llm)
        chunks = list(generator.stream("Test query", []))
        assert chunks == ["Part 1. ", "Part 2."]
