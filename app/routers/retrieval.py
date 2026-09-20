from fastapi import APIRouter, Depends, Request
from app.config import settings
from app.dependencies import get_hybrid_retriever, limiter
from app.schemas.common import APIErrorResponse
from app.schemas.retrieval import RetrieveRequest, RetrieveResponse
from app.services.retrieval_service import RetrievalService
from retrieval.hybrid_retriever import HybridRetriever

router = APIRouter(prefix="/retrieve", tags=["Retrieval & Reranking"])


def get_retrieval_service(
    retriever: HybridRetriever = Depends(get_hybrid_retriever),
) -> RetrievalService:
    return RetrievalService(retriever=retriever)


@router.post(
    "",
    response_model=RetrieveResponse,
    responses={
        422: {"model": APIErrorResponse, "description": "Validation Error"},
        500: {"model": APIErrorResponse, "description": "Retrieval Engine Error"},
    },
    summary="Semantic DSA Problem Search & Reranking",
    description=(
        "Executes multi-field BM25 search, dense semantic embedding vector search over ChromaDB, "
        "merges candidates via Reciprocal Rank Fusion (RRF), and applies cross-encoder precision reranking."
    ),
)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def retrieve_problems(
    request: Request,
    payload: RetrieveRequest,
    service: RetrievalService = Depends(get_retrieval_service),
) -> RetrieveResponse:
    return service.retrieve_problems(query=payload.query, top_k=payload.top_k)
