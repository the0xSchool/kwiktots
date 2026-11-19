"""Two note tools that call the existing REST API."""

import json
import os
import urllib.request

API_URL = os.environ.get("NOTES_API_URL", "http://localhost:8000")


def list_notes() -> str:
    with urllib.request.urlopen(f"{API_URL}/notes") as response:
        notes = json.load(response)
    if not notes:
        return "There are no notes yet."
    titles = ", ".join(note["title"] for note in notes)
    return f"There are {len(notes)} notes: {titles}."


def create_note(title: str, body: str) -> str:
    request = urllib.request.Request(
        f"{API_URL}/notes",
        data=json.dumps({"title": title, "body": body}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        note = json.load(response)
    return f"Created the note '{note['title']}'."


TOOLS = [
    {
        "name": "list_notes",
        "description": "List the titles of all saved notes.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "create_note",
        "description": "Create a new note with a title and a body.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short title of the note."},
                "body": {"type": "string", "description": "Text of the note."},
            },
            "required": ["title", "body"],
            "additionalProperties": False,
        },
    },
]

ACTIONS = {"list_notes": list_notes, "create_note": create_note}


def run_tool(name: str, args: dict) -> str:
    return ACTIONS[name](**args)
