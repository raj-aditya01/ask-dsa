import logging
from typing import Any, Optional
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("askdsa.api")


class ASKDSAException(Exception):
    """Base exception for ASK-DSA API."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class RetrievalException(ASKDSAException):
    """Raised when retrieval fails."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            code="RETRIEVAL_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


class LLMException(ASKDSAException):
    """Raised when LLM invocation or API key configuration fails."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            code="LLM_GENERATION_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details,
        )


async def askdsa_exception_handler(request: Request, exc: ASKDSAException) -> JSONResponse:
    """Handle custom application exceptions."""
    logger.error("Application error on %s: %s (code=%s)", request.url.path, exc.message, exc.code)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Format request validation errors consistently."""
    errors = exc.errors()
    simplified_errors = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        simplified_errors.append(f"{loc}: {err.get('msg', 'invalid value')}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request payload.",
                "details": simplified_errors,
            }
        },
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Fallback handler for unhandled exceptions."""
    logger.exception("Unhandled server exception on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing your request.",
                "details": str(exc),
            }
        },
    )
