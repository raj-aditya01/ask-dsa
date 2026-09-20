import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.dependencies import get_dsa_generator, get_hybrid_retriever, limiter
from app.exceptions import (
    ASKDSAException,
    askdsa_exception_handler,
    general_exception_handler,
    validation_exception_handler,
)
from app.routers import chat_router, health_router, retrieval_router

# Configure root application logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("askdsa.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events: Warm up models and connections on startup.
    """
    logger.info("Initializing %s v%s...", settings.APP_NAME, settings.APP_VERSION)
    try:
        # Pre-warm hybrid retriever to load embeddings & cross-encoder upfront
        logger.info("Pre-warming HybridRetriever and vector stores...")
        get_hybrid_retriever()
        logger.info("Pre-warming DSAGenerator LLM client...")
        get_dsa_generator()
        logger.info("Startup complete! All services warmed and ready for requests.")
    except Exception as exc:
        logger.warning("Startup pre-warm encountered an issue (will retry on demand): %s", exc)

    yield

    logger.info("Shutting down %s...", settings.APP_NAME)


def create_app() -> FastAPI:
    """FastAPI Application Factory."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=settings.APP_DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # 1. Attach SlowAPI Rate Limiter
    app.state.limiter = limiter

    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded: {exc.detail}",
                }
            },
        )

    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    # 2. Register Custom Exception Handlers
    app.add_exception_handler(ASKDSAException, askdsa_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)

    # 3. Add CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 4. Request Timing & Correlation ID Middleware
    @app.middleware("http")
    async def add_timing_and_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start_time = time.perf_counter()

        response = await call_next(request)

        process_time_ms = (time.perf_counter() - start_time) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time_ms:.2f}ms"
        return response

    # 5. Include API Routers with v1 prefix
    api_v1_prefix = "/api/v1"
    app.include_router(health_router, prefix=api_v1_prefix)
    app.include_router(retrieval_router, prefix=api_v1_prefix)
    app.include_router(chat_router, prefix=api_v1_prefix)

    # 6. Static files & Web Dashboard
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    os.makedirs(static_dir, exist_ok=True)
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    # Root route: serves interactive Web Dashboard for browser requests, or JSON API info
    @app.get("/", tags=["UI & Status"])
    async def root(request: Request):
        index_file = os.path.join(static_dir, "index.html")
        accept = request.headers.get("accept", "")
        if "text/html" in accept and os.path.exists(index_file):
            return FileResponse(index_file)
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "dashboard": "/dashboard",
            "health": f"{api_v1_prefix}/health",
        }

    @app.get("/dashboard", include_in_schema=False)
    async def dashboard():
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"message": "Dashboard UI not found"})

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
