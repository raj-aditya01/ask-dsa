from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import TimingMetrics
from app.schemas.retrieval import QueryRouting, RetrievedProblem


class AskRequest(BaseModel):
    """Payload for full RAG solution generation."""
    query: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        json_schema_extra={"example": "How do I find the longest palindromic substring?"},
        description="The DSA problem or question to solve",
    )
    top_k: Optional[int] = Field(
        None,
        ge=1,
        le=20,
        description="Number of context problems to retrieve and ground against",
    )
    temperature: Optional[float] = Field(
        0.1,
        ge=0.0,
        le=1.0,
        description="Sampling temperature for the LLM",
    )
    include_sources: bool = Field(
        True,
        description="Whether to return the retrieved source problems in the response",
    )


class AskResponse(BaseModel):
    """Complete synchronous RAG response."""
    query: str
    answer: str
    sources: Optional[List[RetrievedProblem]] = None
    routing: QueryRouting
    metrics: TimingMetrics
