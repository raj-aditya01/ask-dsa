import os
from fastapi import APIRouter
from app.config import settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health & Status"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns the status of the API, vector database availability, and LLM configuration.",
)
async def health_check() -> HealthResponse:
    chroma_exists = os.path.exists(os.path.join(os.path.dirname(__file__), "..", "..", "chroma_db"))
    has_api_key = bool(os.getenv("GROQ_API_KEY") or settings.GROQ_API_KEY)

    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        retrieval_ready=chroma_exists,
        llm_ready=has_api_key,
        model=settings.GROQ_MODEL,
    )
