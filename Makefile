.PHONY: install dev test

BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 5173

install:
	cd backend && uv sync --group dev
	cd frontend && npm ci

dev:
	@trap 'trap - EXIT INT TERM; kill 0' EXIT INT TERM; \
	(cd backend && BACKEND_PORT=$(BACKEND_PORT) uv run uvicorn app.main:app --reload --port $(BACKEND_PORT)) & \
	(cd frontend && BACKEND_PORT=$(BACKEND_PORT) npm run dev -- --port $(FRONTEND_PORT)) & \
	wait

test:
	cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm test -- --run && npm run lint && npm run typecheck
