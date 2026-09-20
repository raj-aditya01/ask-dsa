import logging
import time
from typing import Optional

from app.exceptions import RetrievalException
from app.schemas.common import TimingMetrics
from app.schemas.retrieval import QueryRouting, RetrieveResponse, RetrievedProblem
from retrieval.hybrid_retriever import HybridRetriever

logger = logging.getLogger("askdsa.service.retrieval")


class RetrievalService:
    """Service orchestrating multi-stage hybrid retrieval & reranking."""

    def __init__(self, retriever: HybridRetriever):
        self.retriever = retriever

    def retrieve_problems(
        self,
        query: str,
        top_k: Optional[int] = None,
    ) -> RetrieveResponse:
        """
        Execute candidate retrieval and reranking for a given query.
        """
        start_time = time.perf_counter()

        try:
            raw_response = self.retriever.retrieve(query=query, top_k=top_k)
        except Exception as exc:
            logger.error("Error executing retrieval for query '%s': %s", query, exc)
            raise RetrievalException(f"Retrieval engine failed: {exc}")

        retrieval_ms = (time.perf_counter() - start_time) * 1000

        routing_dict = raw_response.get("routing", {})
        results_list = raw_response.get("results", [])

        routing = QueryRouting(
            original_query=routing_dict.get("original_query", query),
            cleaned_query=routing_dict.get("cleaned_query") or routing_dict.get("modified_query", query),
            difficulty=routing_dict.get("difficulty"),
            topic=routing_dict.get("topic"),
            topics=routing_dict.get("topics", []),
            strategy=routing_dict.get("strategy", "specific_qa"),
            use_hybrid=routing_dict.get("use_hybrid", True),
            use_mmr=routing_dict.get("use_mmr", False),
        )

        retrieved_problems = []
        for item in results_list:
            retrieved_problems.append(
                RetrievedProblem(
                    problem_id=str(item.get("problem_id", "")),
                    title=item.get("title", "Unknown"),
                    difficulty=item.get("difficulty", "Unknown"),
                    category=item.get("category", "Algorithms"),
                    topics=item.get("topics", []),
                    score=float(item.get("score", 0.0)),
                    rerank_score=float(item["rerank_score"]) if "rerank_score" in item else None,
                    text=item.get("text", ""),
                )
            )

        metrics = TimingMetrics(
            retrieval_ms=round(retrieval_ms, 2),
            generation_ms=None,
            total_ms=round(retrieval_ms, 2),
        )

        return RetrieveResponse(
            query=query,
            routing=routing,
            total_results=len(retrieved_problems),
            results=retrieved_problems,
            metrics=metrics,
        )
