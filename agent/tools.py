"""Two note tools that call the existing REST API."""

import json
import os
import urllib.request
import urllib.error

API_URL = os.environ.get("NOTES_API_URL", "http://localhost:8000")


def list_notes() -> str:
    with urllib.request.urlopen(f"{API_URL}/notes", timeout=10) as response:
        notes = json.load(response)
    if not notes:
        return "There are no notes yet."
    titles = ", ".join(f"{note['id']}: {note['title']}" for note in notes)
    return f"There are {len(notes)} notes: {titles}."


def create_note(title: str, body: str) -> str:
    request = urllib.request.Request(
        f"{API_URL}/notes",
        data=json.dumps({"title": title, "body": body}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        note = json.load(response)
    return f"Created note id {note['id']}: '{note['title']}'."


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
    action = ACTIONS.get(name)
    if action is None:
        return f"Error: unknown tool '{name}'."
    try:
        return action(**args)
    except urllib.error.HTTPError as e:
        return f"Error: the notes API refused the request ({e.code})."
    except urllib.error.URLError:
        return "Error: the notes service is not reachable. Tell the user to try again later."
    except TimeoutError:
        return "Error: the notes service took too long to answer. Tell the user to try again."
