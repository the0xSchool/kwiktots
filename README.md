# kwiktots

A small note-taking app.

- `backend/`: a FastAPI service that keeps notes in memory. Notes are lost when the server restarts. This is intentional.
- `frontend/`: a TypeScript, React and Vite app for writing and managing notes.

## Run it

### Prerequisites

- Python 3.12 or later, with [`uv`](https://docs.astral.sh/uv/) installed.
- Node 24.

### First-time setup

```bash
make install
```

This runs `uv sync` for the backend and `npm ci` for the frontend.

### Start both apps

```bash
make dev
```

This starts the backend and the frontend together, and stops both when you
press Ctrl+C.

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

Notes are kept in memory on the backend, so they are lost when the backend
restarts.

### Run the tests

```bash
make test
```

This runs the backend test suite (pytest, then ruff) and the frontend test
suite (Vitest, then eslint and the TypeScript checker).

### Smoke check

```bash
scripts/smoke.sh
```

This starts the backend and the Vite dev server, creates, lists, updates
and deletes a note through the Vite proxy, checks each response, and shuts
both down. It exits non-zero on any failure. Set `BACKEND_PORT` and
`FRONTEND_PORT` to use different ports.
