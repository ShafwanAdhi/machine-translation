import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.settings import Settings


class FakeEngine:
    def __init__(self, settings):
        self.started = threading.Event()
        self.release = threading.Event()
        self.hold = False

    def translate(self, text, models, reference):
        if self.hold:
            self.started.set()
            assert self.release.wait(8)
        return [{"model": m, "translation": "hello", "latency_ms": 1.0, "oov_count": 0,
                 "bleu": {"BLEU-1": 1.0} if reference else None} for m in models]


@pytest.fixture
def client():
    with TestClient(create_app(Settings(), FakeEngine)) as client:
        yield client


def test_health_and_default_models(client):
    assert client.get("/health").json()["ready"] is True
    data = client.post("/api/translate", json={"text": "halo"}).json()
    assert [r["model"] for r in data["results"]] == ["no_attention", "attention"]
    assert not data["reference_provided"]
    assert all(r["bleu"] is None for r in data["results"])


@pytest.mark.parametrize("payload", [
    {"text": " "}, {"text": "a" * 1001}, {"text": " ".join(["a"] * 61)},
    {"text": "halo", "models": ["other"]}, {"text": "halo", "models": []},
    {"text": "halo", "models": ["attention", "attention"]},
    {"text": "halo", "reference": "x" * 1001}, {"text": "halo", "reference": " ".join(["a"] * 61)},
])
def test_input_limits(client, payload):
    assert client.post("/api/translate", json=payload).status_code == 422


def test_optional_reference(client):
    empty = client.post("/api/translate", json={"text": "halo", "reference": "  "}).json()
    assert not empty["reference_provided"] and empty["results"][0]["bleu"] is None
    valid = client.post("/api/translate", json={"text": "halo", "reference": "hello"}).json()
    assert valid["reference_provided"] and valid["results"][0]["bleu"] is not None


def test_rate_limit(client):
    for _ in range(10):
        assert client.post("/api/translate", json={"text": "halo"}).status_code == 200
    response = client.post("/api/translate", json={"text": "halo"})
    assert response.status_code == 429 and response.headers["Retry-After"] == "60"


def test_inference_busy_and_health_responsive(client):
    engine = client.app.state.engine
    engine.hold = True
    with ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(client.post, "/api/translate", json={"text": "halo"})
        try:
            assert engine.started.wait(5)
            assert client.get("/health").status_code == 200
            assert client.post("/api/translate", json={"text": "lagi"}).status_code == 429
        finally:
            engine.release.set()
        assert first.result(timeout=5).status_code == 200


def test_predictions_and_artifacts(client):
    all_rows = client.get("/api/predictions").json()
    assert all_rows["total"] == 1999 and len(all_rows["items"]) == 25
    long_rows = client.get("/api/predictions?length=long&page_size=100").json()
    assert long_rows["total"] == 32 and all(r["source_length"] >= 25 for r in long_rows["items"])
    query = client.get("/api/predictions?q=kau%20lihat").json()
    assert query["total"] > 0
    review = client.get("/api/predictions?review_only=true").json()
    assert all(row["review"] is not None for row in review["items"])
    assert client.get("/api/predictions?exact=either").json()["total"] <= 1999
    assert client.get("/api/predictions?page_size=101").status_code == 422
    assert client.get("/api/predictions?page=0").status_code == 422
    download = client.get("/api/artifacts/summary")
    assert download.status_code == 200 and 'attachment' in download.headers["content-disposition"]
    image = client.get("/api/artifacts/attention_pendek?download=false")
    assert image.status_code == 200 and image.headers["content-type"] == "image/png"
    assert client.get("/api/artifacts/not-allowed").status_code == 404
    assert client.get("/api/nonexistent").status_code == 404


def test_body_limit(client):
    assert client.post("/api/translate", content=b"x" * 8193).status_code == 413


def test_benchmark(client):
    data = client.get("/api/benchmark").json()
    assert sum(len(v) for v in data["history"].values()) == 20
    assert len(data["attention_images"]) == 3
    assert data["models"][0]["selected_epoch"] == 3
    assert data["models"][1]["selected_epoch"] == 2
