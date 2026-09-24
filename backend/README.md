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

## API notes

- `title` is required, trimmed, and 1 to 200 characters after trimming.
- `body` is optional. Leaving it out of a `POST` or `PUT` request defaults
  it to an empty string; it can also be an empty string of up to 10,000
  characters.

## Test

```bash
uv run pytest
```

## Lint

```bash
uv run ruff check .
uv run ruff format --check .
```
