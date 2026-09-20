import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration and environment settings."""

    APP_NAME: str = "ASK-DSA API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "Production-grade RAG API for Data Structures & Algorithms problem solving and tutoring."
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS settings - allows frontend dashboards to communicate smoothly
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*",
    ]

    # Groq LLM & Retrieval configurations
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    DEFAULT_TOP_K: int = 5
    CANDIDATE_K: int = 40
    TEMPERATURE: float = 0.1

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_GENERATE: str = "30/minute"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
