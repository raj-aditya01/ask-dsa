import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.dependencies import get_dsa_generator
from app.main import app
from retrieval.generator import DSAGenerator


@pytest.fixture
def client():
    """Create a FastAPI test client."""
    with TestClient(app) as test_client:
        yield test_client


class TestAPIEndpoints:
    def test_root_endpoint(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert data["docs"] == "/docs"
        assert "X-Request-ID" in response.headers
        assert "X-Process-Time" in response.headers

    def test_health_endpoint(self, client):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "retrieval_ready" in data
        assert "llm_ready" in data
        assert "model" in data

    def test_retrieve_validation_error(self, client):
        # query too short (min_length=2)
        response = client.post("/api/v1/retrieve", json={"query": "x"})
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "VALIDATION_ERROR"

    def test_retrieve_endpoint_success(self, client):
        response = client.post(
            "/api/v1/retrieve",
            json={"query": "Two Sum", "top_k": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "Two Sum"
        assert "routing" in data
        assert data["routing"]["cleaned_query"] == "Two Sum"
        assert len(data["results"]) > 0
        assert data["results"][0]["problem_id"] == "1"
        assert "metrics" in data
        assert "retrieval_ms" in data["metrics"]

    def test_ask_endpoint_with_mock_generator(self, client):
        mock_generator = MagicMock(spec=DSAGenerator)
        mock_generator.generate.return_value = "Mocked optimal Two Sum solution."

        app.dependency_overrides[get_dsa_generator] = lambda: mock_generator

        try:
            response = client.post(
                "/api/v1/ask",
                json={"query": "How to solve Two Sum?", "top_k": 2},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["answer"] == "Mocked optimal Two Sum solution."
            assert "sources" in data
            assert len(data["sources"]) > 0
            assert "metrics" in data
            assert data["metrics"]["generation_ms"] is not None
        finally:
            app.dependency_overrides.clear()

    def test_stream_get_endpoint_with_mock_generator(self, client):
        mock_generator = MagicMock(spec=DSAGenerator)
        mock_generator.stream.return_value = iter(["Token1 ", "Token2"])

        app.dependency_overrides[get_dsa_generator] = lambda: mock_generator

        try:
            response = client.get("/api/v1/ask/stream?query=Two%20Sum&top_k=2")
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            text = response.text
            assert "data: " in text
            assert '"type": "metadata"' in text
            assert '"type": "token"' in text
            assert '"type": "done"' in text
        finally:
            app.dependency_overrides.clear()

    def test_dashboard_endpoint(self, client):
        response = client.get("/dashboard")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "ASK-DSA" in response.text
        assert "Omnisearch" in response.text or "query-input" in response.text

    def test_browser_root_returns_html(self, client):
        response = client.get("/", headers={"Accept": "text/html,application/xhtml+xml"})
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "ASK-DSA" in response.text

    def test_static_assets(self, client):
        js_res = client.get("/static/app.js")
        assert js_res.status_code == 200
        css_res = client.get("/static/style.css")
        assert css_res.status_code == 200

