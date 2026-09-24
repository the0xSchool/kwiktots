"""Pydantic models for the notes API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

TITLE_MAX_LENGTH = 200
BODY_MAX_LENGTH = 10_000


class NoteIn(BaseModel):
    """Request body for creating or updating a note."""

    model_config = ConfigDict(extra="forbid")

    title: str
    body: str = ""

    @field_validator("title")
    @classmethod
    def title_must_be_trimmed_and_sized(cls, value: str) -> str:
        trimmed = value.strip()
        if not (1 <= len(trimmed) <= TITLE_MAX_LENGTH):
            raise ValueError(f"title must be 1 to {TITLE_MAX_LENGTH} characters after trimming")
        return trimmed

    @field_validator("body")
    @classmethod
    def body_must_not_exceed_max_length(cls, value: str) -> str:
        if len(value) > BODY_MAX_LENGTH:
            raise ValueError(f"body must be at most {BODY_MAX_LENGTH} characters")
        return value


class Note(BaseModel):
    """A stored note, as returned by the API."""

    id: str
    title: str
    body: str
    created_at: datetime
    updated_at: datetime
