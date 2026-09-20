import logging
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from retrieval.generator import DSAGenerator, create_groq_llm
from retrieval.hybrid_retriever import HybridRetriever, get_retriever

logger = logging.getLogger("askdsa.api")

# Rate limiter based on client IP
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_DEFAULT])

_generator_instance: Optional[DSAGenerator] = None


def get_hybrid_retriever() -> HybridRetriever:
    """Dependency provider for the singleton HybridRetriever."""
    return get_retriever()


def get_dsa_generator() -> DSAGenerator:
    """Dependency provider for the singleton DSAGenerator."""
    global _generator_instance
    if _generator_instance is None:
        logger.info("Initializing DSAGenerator with model=%s", settings.GROQ_MODEL)
        llm = create_groq_llm(
            model_name=settings.GROQ_MODEL,
            temperature=settings.TEMPERATURE,
        )
        _generator_instance = DSAGenerator(llm=llm)
    return _generator_instance
