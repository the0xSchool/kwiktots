"""The FastAPI app for the in-memory notes API."""

import os
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from app.models import Note, NoteIn
from app.store import NoteStore

DEFAULT_CORS_ORIGINS = "http://localhost:5173"


def cors_origins_from_env() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def get_store(request: Request) -> NoteStore:
    """FastAPI dependency that reads the store off app state.

    Tests replace ``app.state.store`` with a fresh ``NoteStore`` so each
    test starts empty.
    """
    return request.app.state.store


StoreDep = Annotated[NoteStore, Depends(get_store)]

app = FastAPI(title="Kwiktots Notes API")
app.state.store = NoteStore()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_from_env(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/notes", response_model=list[Note])
def list_notes(store: StoreDep) -> list[Note]:
    return store.list_notes()


@app.post("/notes", response_model=Note, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteIn, store: StoreDep) -> Note:
    return store.create(payload.title, payload.body)


@app.get("/notes/{note_id}", response_model=Note)
def get_note(note_id: str, store: StoreDep) -> Note:
    note = store.get(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.put("/notes/{note_id}", response_model=Note)
def update_note(note_id: str, payload: NoteIn, store: StoreDep) -> Note:
    note = store.update(note_id, payload.title, payload.body)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: str, store: StoreDep) -> None:
    deleted = store.delete(note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
