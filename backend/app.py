import asyncio
import json
import math
import time
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .domain import clean
from .service import MODEL_IDS, ModelService
from .settings import Settings

ModelId = Literal["no_attention", "attention"]


class TranslationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=1000)
    models: list[ModelId] = Field(default_factory=lambda: list(MODEL_IDS), min_length=1, max_length=2)
    reference: str | None = Field(default=None, max_length=1000)

    @field_validator("text", "reference")
    @classmethod
    def check_text(cls, value, info):
        if value is None:
            return None
        value = value.strip()
        if not value:
            if info.field_name == "reference":
                return None
            raise ValueError("Masukkan teks Indonesia.")
        if len(clean(value).split()) > 60:
            raise ValueError("Maksimal 60 token setelah preprocessing.")
        return value

    @field_validator("models")
    @classmethod
    def unique_models(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Model tidak boleh berulang.")
        return value


class RateLimiter:
    def __init__(self, limit: int):
        self.limit = limit
        self.clients: dict[str, tuple[float, int]] = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        self.clients = {k: v for k, v in self.clients.items() if now - v[0] < 60}
        start, count = self.clients.get(key, (now, 0))
        if count >= self.limit or key not in self.clients and len(self.clients) >= 4096:
            return False
        self.clients[key] = (start, count + 1)
        return True


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > 8192:
                response = JSONResponse({"detail": "Permintaan terlalu besar."}, status_code=413)
                return await response(scope, receive, send)
            if not message.get("more_body"):
                break
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def create_app(settings: Settings | None = None, engine_factory=ModelService) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        app.state.ready = False
        app.state.engine = await run_in_threadpool(engine_factory, settings)
        app.state.benchmark = json.loads((settings.root / "data/benchmark.json").read_text(encoding="utf-8"))
        app.state.predictions = json.loads((settings.root / "data/predictions.json").read_text(encoding="utf-8"))
        app.state.gate = asyncio.Lock()
        app.state.limiter = RateLimiter(settings.rate_limit)
        app.state.ready = True
        yield
        app.state.ready = False
        del app.state.engine

    app = FastAPI(title="MT Lab", lifespan=lifespan, docs_url="/api/docs", redoc_url=None)
    app.add_middleware(BodyLimit)

    @app.middleware("http")
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.get("/health")
    async def health():
        ready = getattr(app.state, "ready", False)
        return JSONResponse({"ready": ready, "models": list(MODEL_IDS) if ready else [], "device": "cpu"}, status_code=200 if ready else 503)

    @app.post("/api/translate")
    async def translate(payload: TranslationInput, request: Request):
        key = request.client.host if request.client else "unknown"
        if not app.state.limiter.allow(key):
            raise HTTPException(429, f"Batas {settings.rate_limit} percobaan per menit. Coba lagi nanti.", headers={"Retry-After": "60"})
        if app.state.gate.locked():
            raise HTTPException(429, "Model sedang digunakan. Coba lagi sebentar.", headers={"Retry-After": "2"})
        async with app.state.gate:
            results = await run_in_threadpool(app.state.engine.translate, payload.text, payload.models, payload.reference)
        return {"results": results, "device": "cpu", "token_count": len(clean(payload.text).split()), "reference_provided": payload.reference is not None}

    @app.get("/api/benchmark")
    async def benchmark():
        return app.state.benchmark

    @app.get("/api/predictions")
    async def predictions(q: str = Query("", max_length=200), length: Literal["all", "short", "medium", "long"] = "all",
                          exact: Literal["all", "either", "neither", "no_attention", "attention"] = "all",
                          review_only: bool = False, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100)):
        query = q.casefold().strip()
        rows = app.state.predictions
        if query:
            rows = [r for r in rows if query in " ".join([r["source"], r["reference"], *r["translations"].values()]).casefold()]
        if length != "all":
            rows = [r for r in rows if r["length_group"] == length]
        if exact == "either":
            rows = [r for r in rows if any(r["exact_matches"].values())]
        elif exact == "neither":
            rows = [r for r in rows if not any(r["exact_matches"].values())]
        elif exact in MODEL_IDS:
            rows = [r for r in rows if r["exact_matches"][exact]]
        if review_only:
            rows = [r for r in rows if r["review"] is not None]
        total = len(rows)
        return {"items": rows[(page - 1) * page_size:page * page_size], "total": total, "page": page,
                "page_size": page_size, "pages": math.ceil(total / page_size)}

    @app.get("/api/artifacts/{key}")
    async def artifact(key: str, download: bool = True):
        entry = app.state.benchmark["artifacts"].get(key)
        if entry is None:
            raise HTTPException(404, "Aset tidak ditemukan.")
        path = settings.root / "data" / "artifacts" / entry["filename"]
        return FileResponse(path, media_type=entry["content_type"], filename=entry["filename"] if download else None,
                            content_disposition_type="attachment" if download else "inline")

    if (settings.static_dir / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=settings.static_dir / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str):
        if path not in ("", "benchmark"):
            raise HTTPException(404, "Halaman tidak ditemukan.")
        index = settings.static_dir / "index.html"
        if not index.is_file():
            raise HTTPException(503, "Frontend belum dibuild.")
        return FileResponse(index)

    return app


app = create_app()
