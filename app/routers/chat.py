from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from app.dependencies import get_dsa_generator, get_hybrid_retriever, limiter
from app.schemas.common import APIErrorResponse
from app.schemas.generation import AskRequest, AskResponse
from app.services.generation_service import GenerationService
from app.services.retrieval_service import RetrievalService
from retrieval.generator import DSAGenerator
from retrieval.hybrid_retriever import HybridRetriever

router = APIRouter(prefix="/ask", tags=["DSA Tutoring & Generation"])


def get_generation_service(
    retriever: HybridRetriever = Depends(get_hybrid_retriever),
    generator: DSAGenerator = Depends(get_dsa_generator),
) -> GenerationService:
    retrieval_service = RetrievalService(retriever=retriever)
    return GenerationService(retrieval_service=retrieval_service, generator=generator)


@router.post(
    "",
    response_model=AskResponse,
    responses={
        422: {"model": APIErrorResponse, "description": "Validation Error"},
        500: {"model": APIErrorResponse, "description": "Internal Server Error"},
        502: {"model": APIErrorResponse, "description": "LLM Provider Error"},
    },
    summary="Ask DSA Question (Synchronous)",
    description=(
        "Executes two-stage retrieval to find the relevant LeetCode problems, constructs grounded context, "
        "and generates an optimal algorithmic explanation, code, and complexity analysis."
    ),
)
@limiter.limit(settings.RATE_LIMIT_GENERATE)
async def ask_question(
    request: Request,
    payload: AskRequest,
    service: GenerationService = Depends(get_generation_service),
) -> AskResponse:
    return service.ask(
        query=payload.query,
        top_k=payload.top_k,
        include_sources=payload.include_sources,
    )


@router.post(
    "/stream",
    summary="Ask DSA Question (Streaming SSE - POST)",
    description="Streams the generated solution token-by-token using Server-Sent Events (SSE).",
)
@limiter.limit(settings.RATE_LIMIT_GENERATE)
async def stream_question_post(
    request: Request,
    payload: AskRequest,
    service: GenerationService = Depends(get_generation_service),
):
    event_generator = service.stream(
        query=payload.query,
        top_k=payload.top_k,
        include_sources=payload.include_sources,
    )
    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/stream",
    summary="Ask DSA Question (Streaming SSE - GET)",
    description="Convenience GET endpoint for event sources to stream solution tokens in real-time.",
)
@limiter.limit(settings.RATE_LIMIT_GENERATE)
async def stream_question_get(
    request: Request,
    query: str = Query(..., min_length=2, max_length=1000, description="The DSA question to solve"),
    top_k: Optional[int] = Query(None, ge=1, le=20),
    include_sources: bool = Query(True),
    service: GenerationService = Depends(get_generation_service),
):
    event_generator = service.stream(
        query=query,
        top_k=top_k,
        include_sources=include_sources,
    )
    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
