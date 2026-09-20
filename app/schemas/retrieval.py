from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import TimingMetrics


class QueryRouting(BaseModel):
    """Metadata extracted during query classification & modification."""
    original_query: str
    cleaned_query: str
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
    strategy: str = "specific_qa"
    use_hybrid: bool = True
    use_mmr: bool = False


class RetrievedProblem(BaseModel):
    """Detailed item representation of a retrieved problem chunk."""
    problem_id: str = Field(..., json_schema_extra={"example": "141"})
    title: str = Field(..., json_schema_extra={"example": "Linked List Cycle"})
    difficulty: str = Field(..., json_schema_extra={"example": "Easy"})
    category: str = Field(default="Algorithms")
    topics: List[str] = Field(default_factory=list)
    score: float = Field(..., description="Reciprocal Rank Fusion score")
    rerank_score: Optional[float] = Field(None, description="Cross-encoder semantic similarity score")
    text: str = Field(..., description="Full problem and chunk text")


class RetrieveRequest(BaseModel):
    """Payload for pure retrieval & reranking."""
    query: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        json_schema_extra={"example": "How to detect a cycle in a linked list?"},
        description="Natural language DSA query or problem description",
    )
    top_k: Optional[int] = Field(
        None,
        ge=1,
        le=20,
        json_schema_extra={"example": 5},
        description="Number of relevant problems to return (defaults to adaptive routing)",
    )


class RetrieveResponse(BaseModel):
    """Response returned by pure retrieval & reranking."""
    query: str
    routing: QueryRouting
    total_results: int
    results: List[RetrievedProblem]
    metrics: TimingMetrics
