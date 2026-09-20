import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("askdsa.reranker")

DEFAULT_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class CrossEncoderReranker:
    """
    High-precision Cross-Encoder Reranker for DSA queries and documents.
    Takes candidate documents from first-stage retrieval (BM25 + Dense)
    and computes full cross-attention relevance scores for (query, doc) pairs.
    """

    def __init__(
        self,
        model_name: str = DEFAULT_RERANKER_MODEL,
        device: Optional[str] = None,
        max_length: int = 512,
    ):
        self.model_name = model_name
        self.max_length = max_length
        self.device = device
        self._model = None
        self._initialized = False

    def _load_model(self):
        if not self._initialized:
            try:
                from sentence_transformers import CrossEncoder

                logger.info("Loading Cross-Encoder model: %s", self.model_name)
                self._model = CrossEncoder(
                    self.model_name,
                    max_length=self.max_length,
                    device=self.device,
                )
                self._initialized = True
                logger.info("Cross-Encoder loaded successfully.")
            except Exception as e:
                logger.warning(
                    "Failed to load CrossEncoder model '%s': %s. Will fallback to heuristic scoring.",
                    self.model_name,
                    e,
                )
                self._initialized = True
                self._model = None

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Reranks a list of candidate documents against the query.

        Args:
            query: The user query string.
            candidates: List of dicts, each with keys like 'title', 'text', 'score', etc.
            top_k: Number of top candidates to return.

        Returns:
            Reranked list of candidates with updated 'rerank_score' and sorted by relevance.
        """
        if not candidates:
            return []

        self._load_model()

        # If CrossEncoder is unavailable, return candidates sorted by initial score
        if self._model is None:
            return candidates[:top_k]

        # Prepare (query, doc_text) pairs
        pairs = []
        for doc in candidates:
            title = doc.get("title", "")
            topics = doc.get("topics", [])
            topics_str = ", ".join(topics) if isinstance(topics, list) else str(topics)
            text = doc.get("text", "")
            
            # Formulate informative document text for cross-encoder
            doc_repr = f"Title: {title} | Topics: {topics_str} | Content: {text[:600]}"
            pairs.append((query, doc_repr))

        try:
            scores = self._model.predict(pairs)
            scored_candidates = []
            for doc, score in zip(candidates, scores):
                doc_copy = dict(doc)
                doc_copy["rerank_score"] = float(score)
                scored_candidates.append(doc_copy)

            # Sort descending by cross-encoder score
            scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
            return scored_candidates[:top_k]

        except Exception as e:
            logger.error("Error during cross-encoder prediction: %s", e)
            return candidates[:top_k]
