import time


def create_note(client, title="Groceries", body="Milk and eggs"):
    return client.post("/notes", json={"title": title, "body": body})


def test_list_notes_empty_returns_empty_list(client):
    response = client.get("/notes")

    assert response.status_code == 200
    assert response.json() == []


def test_create_note_returns_201_with_created_note(client):
    response = create_note(client, title="Groceries", body="Milk and eggs")

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Groceries"
    assert data["body"] == "Milk and eggs"
    assert "id" in data
    assert data["created_at"] == data["updated_at"]


def test_create_note_allows_empty_body(client):
    response = create_note(client, title="Groceries", body="")

    assert response.status_code == 201
    assert response.json()["body"] == ""


def test_create_note_without_body_key_defaults_to_empty_string(client):
    response = client.post("/notes", json={"title": "Groceries"})

    assert response.status_code == 201
    assert response.json()["body"] == ""


def test_create_note_strips_title_whitespace(client):
    response = create_note(client, title="  Groceries  ", body="")

    assert response.status_code == 201
    assert response.json()["title"] == "Groceries"


def test_create_note_missing_title_returns_422(client):
    response = client.post("/notes", json={"body": "no title here"})

    assert response.status_code == 422


def test_create_note_blank_title_returns_422(client):
    response = client.post("/notes", json={"title": "   ", "body": "blank title"})

    assert response.status_code == 422


def test_create_note_title_too_long_returns_422(client):
    response = client.post("/notes", json={"title": "a" * 201, "body": ""})

    assert response.status_code == 422


def test_create_note_title_at_max_length_is_accepted(client):
    response = client.post("/notes", json={"title": "a" * 200, "body": ""})

    assert response.status_code == 201


def test_create_note_body_too_long_returns_422(client):
    response = client.post("/notes", json={"title": "Groceries", "body": "a" * 10001})

    assert response.status_code == 422


def test_create_note_unknown_field_returns_422(client):
    response = client.post("/notes", json={"title": "Groceries", "body": "", "extra": "nope"})

    assert response.status_code == 422


def test_get_note_returns_200_with_note(client):
    created = create_note(client).json()

    response = client.get(f"/notes/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_note_returns_404_when_missing(client):
    response = client.get("/notes/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"detail": "Note not found"}


def test_update_note_returns_200_with_updated_note(client):
    created = create_note(client, title="Groceries", body="Milk").json()

    response = client.put(
        f"/notes/{created['id']}", json={"title": "Groceries v2", "body": "Milk and bread"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Groceries v2"
    assert data["body"] == "Milk and bread"
    assert data["id"] == created["id"]


def test_update_note_bumps_updated_at_and_keeps_created_at(client):
    created = create_note(client).json()
    time.sleep(0.01)

    response = client.put(f"/notes/{created['id']}", json={"title": "Groceries", "body": "Updated"})

    data = response.json()
    assert data["created_at"] == created["created_at"]
    assert data["updated_at"] != created["updated_at"]


def test_update_note_returns_404_when_missing(client):
    response = client.put("/notes/does-not-exist", json={"title": "x", "body": ""})

    assert response.status_code == 404
    assert response.json() == {"detail": "Note not found"}


def test_update_note_blank_title_returns_422(client):
    created = create_note(client).json()

    response = client.put(f"/notes/{created['id']}", json={"title": "  ", "body": ""})

    assert response.status_code == 422


def test_delete_note_returns_204(client):
    created = create_note(client).json()

    response = client.delete(f"/notes/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/notes/{created['id']}").status_code == 404


def test_delete_note_returns_404_when_missing(client):
    response = client.delete("/notes/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"detail": "Note not found"}


def test_list_notes_returns_newest_updated_first(client):
    first = create_note(client, title="First", body="").json()
    time.sleep(0.01)
    second = create_note(client, title="Second", body="").json()
    time.sleep(0.01)
    # Touch "first" so it becomes the most recently updated.
    client.put(f"/notes/{first['id']}", json={"title": "First", "body": "touched"})

    response = client.get("/notes")

    assert response.status_code == 200
    ids_in_order = [note["id"] for note in response.json()]
    assert ids_in_order == [first["id"], second["id"]]
