from typing import Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check payload."""
    status: str = Field(..., json_schema_extra={"example": "healthy"})
    version: str = Field(..., json_schema_extra={"example": "1.0.0"})
    retrieval_ready: bool = Field(..., json_schema_extra={"example": True})
    llm_ready: bool = Field(..., json_schema_extra={"example": True})
    model: str = Field(..., json_schema_extra={"example": "openai/gpt-oss-120b"})


class TimingMetrics(BaseModel):
    """Timing and latency metrics for pipeline transparency."""
    retrieval_ms: float = Field(..., description="Time taken for dense + BM25 + Reranking")
    generation_ms: Optional[float] = Field(None, description="Time taken for LLM answer generation")
    total_ms: float = Field(..., description="Total end-to-end request processing time")


class ErrorDetail(BaseModel):
    """Standardized error object."""
    code: str = Field(..., json_schema_extra={"example": "VALIDATION_ERROR"})
    message: str = Field(..., json_schema_extra={"example": "Invalid query parameter"})
    details: Optional[Any] = None


class APIErrorResponse(BaseModel):
    """Standardized JSON error envelope."""
    error: ErrorDetail
