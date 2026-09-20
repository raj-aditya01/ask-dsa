"""ASK-DSA Production API Package."""

from app.config import settings
from app.main import app

__all__ = ["app", "settings"]
