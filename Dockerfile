FROM node:24-alpine AS frontend
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TORCH_THREADS=2 \
    OMP_NUM_THREADS=2 \
    MKL_NUM_THREADS=2 \
    RATE_LIMIT_PER_MINUTE=10 \
    FORWARDED_ALLOW_IPS=127.0.0.1 \
    HOME=/tmp
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app
COPY requirements.txt ./
RUN python -m pip install -r requirements.txt
COPY --chown=app:app backend/ ./backend/
COPY --chown=app:app models/ ./models/
COPY --chown=app:app data/ ./data/
COPY --chown=app:app assets-manifest.json ./assets-manifest.json
COPY --from=frontend --chown=app:app /web/dist/ ./frontend/dist/
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=4)"
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
