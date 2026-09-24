import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import NoteStore


@pytest.fixture
def client():
    """A TestClient backed by a fresh, empty NoteStore for each test."""
    app.state.store = NoteStore()
    with TestClient(app) as test_client:
        yield test_client
