import json
import logging
import time
from typing import AsyncGenerator, Optional

from app.exceptions import LLMException
from app.schemas.common import TimingMetrics
from app.schemas.generation import AskResponse
from app.services.retrieval_service import RetrievalService
from retrieval.generator import DSAGenerator

logger = logging.getLogger("askdsa.service.generation")


class GenerationService:
    """Service orchestrating full RAG solution generation."""

    def __init__(self, retrieval_service: RetrievalService, generator: DSAGenerator):
        self.retrieval_service = retrieval_service
        self.generator = generator

    def ask(
        self,
        query: str,
        top_k: Optional[int] = None,
        include_sources: bool = True,
    ) -> AskResponse:
        """
        Synchronously retrieve relevant problems and generate a grounded DSA answer.
        """
        overall_start = time.perf_counter()

        # 1. Retrieve candidates
        retrieval_response = self.retrieval_service.retrieve_problems(query=query, top_k=top_k)
        results = [item.model_dump() for item in retrieval_response.results]

        # 2. Generate answer
        gen_start = time.perf_counter()
        try:
            answer = self.generator.generate(query=query, results=results)
        except Exception as exc:
            logger.error("LLM generation error for query '%s': %s", query, exc)
            raise LLMException(f"Failed to generate answer from LLM: {exc}")

        gen_ms = (time.perf_counter() - gen_start) * 1000
        total_ms = (time.perf_counter() - overall_start) * 1000

        metrics = TimingMetrics(
            retrieval_ms=retrieval_response.metrics.retrieval_ms,
            generation_ms=round(gen_ms, 2),
            total_ms=round(total_ms, 2),
        )

        return AskResponse(
            query=query,
            answer=answer,
            sources=retrieval_response.results if include_sources else None,
            routing=retrieval_response.routing,
            metrics=metrics,
        )

    def stream(
        self,
        query: str,
        top_k: Optional[int] = None,
        include_sources: bool = True,
    ) -> AsyncGenerator[str, None]:
        """
        Stream the generated solution token-by-token formatted as Server-Sent Events (SSE).
        """
        overall_start = time.perf_counter()

        # Step 1: Retrieval
        try:
            retrieval_response = self.retrieval_service.retrieve_problems(query=query, top_k=top_k)
            results = [item.model_dump() for item in retrieval_response.results]
        except Exception as exc:
            err_payload = json.dumps({"type": "error", "message": f"Retrieval failed: {exc}"})
            yield f"data: {err_payload}\n\n"
            return

        # Emit initial metadata event with routing and sources
        meta_payload = {
            "type": "metadata",
            "routing": retrieval_response.routing.model_dump(),
            "sources": [s.model_dump() for s in retrieval_response.results] if include_sources else [],
            "retrieval_ms": retrieval_response.metrics.retrieval_ms,
        }
        yield f"data: {json.dumps(meta_payload)}\n\n"

        # Step 2: Stream tokens from LLM
        try:
            for token in self.generator.stream(query=query, results=results):
                token_payload = json.dumps({"type": "token", "content": token})
                yield f"data: {token_payload}\n\n"
        except Exception as exc:
            err_payload = json.dumps({"type": "error", "message": f"LLM streaming error: {exc}"})
            yield f"data: {err_payload}\n\n"
            return

        total_ms = (time.perf_counter() - overall_start) * 1000
        done_payload = json.dumps({"type": "done", "total_ms": round(total_ms, 2)})
        yield f"data: {done_payload}\n\n"
