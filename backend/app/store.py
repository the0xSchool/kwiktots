"""An in-memory, thread-safe store of notes."""

import threading
import uuid
from datetime import UTC, datetime

from app.models import Note


class NoteStore:
    """Holds notes in a dict behind a lock, so concurrent requests are safe."""

    def __init__(self) -> None:
        self._notes: dict[str, Note] = {}
        self._lock = threading.Lock()

    def list_notes(self) -> list[Note]:
        with self._lock:
            notes = list(self._notes.values())
        return sorted(notes, key=lambda note: note.updated_at, reverse=True)

    def get(self, note_id: str) -> Note | None:
        with self._lock:
            return self._notes.get(note_id)

    def create(self, title: str, body: str) -> Note:
        now = datetime.now(UTC)
        note = Note(
            id=str(uuid.uuid4()),
            title=title,
            body=body,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._notes[note.id] = note
        return note

    def update(self, note_id: str, title: str, body: str) -> Note | None:
        with self._lock:
            existing = self._notes.get(note_id)
            if existing is None:
                return None
            updated = existing.model_copy(
                update={
                    "title": title,
                    "body": body,
                    "updated_at": datetime.now(UTC),
                }
            )
            self._notes[note_id] = updated
        return updated

    def delete(self, note_id: str) -> bool:
        with self._lock:
            return self._notes.pop(note_id, None) is not None
