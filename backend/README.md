# Kwiktots backend

An in-memory notes API built with FastAPI. Notes live in memory only, so a
restart clears them.

## Install

```bash
uv sync --group dev
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 8000
```

The API serves `http://localhost:8000`. `CORS_ORIGINS` sets the allowed
origins as a comma-separated list; it defaults to `http://localhost:5173`,
the Vite dev server.

## Test

```bash
uv run pytest
```

## Lint

```bash
uv run ruff check .
uv run ruff format --check .
```
