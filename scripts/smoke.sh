#!/usr/bin/env bash
# End-to-end smoke check: starts the backend and the Vite dev server, then
# creates, lists, updates and deletes a note through the Vite proxy.
# Exits non-zero on any failure. Ports come from BACKEND_PORT and
# FRONTEND_PORT so this can run alongside other local servers.
set -u -o pipefail

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="http://localhost:${FRONTEND_PORT}/api"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null
    wait "$FRONTEND_PID" 2>/dev/null
  fi
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null
    wait "$BACKEND_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

wait_for() {
  local url="$1"
  local name="$2"
  for _ in $(seq 1 50); do
    if curl -s -o /dev/null "$url"; then
      return 0
    fi
    sleep 0.2
  done
  fail "$name did not become ready at $url"
}

echo "Starting backend on port ${BACKEND_PORT}..."
(cd "$ROOT_DIR/backend" && uv run uvicorn app.main:app --port "$BACKEND_PORT") &
BACKEND_PID=$!

wait_for "http://localhost:${BACKEND_PORT}/health" "backend"

echo "Starting frontend dev server on port ${FRONTEND_PORT}..."
# Run the local vite binary directly (not via "npm run dev" or "npx"), so
# this script's PID is the actual vite process and cleanup can kill it.
(cd "$ROOT_DIR/frontend" && BACKEND_PORT="$BACKEND_PORT" ./node_modules/.bin/vite --port "$FRONTEND_PORT" --strictPort) &
FRONTEND_PID=$!

wait_for "http://localhost:${FRONTEND_PORT}/" "frontend"
wait_for "${BASE_URL}/notes" "proxy"

echo "Creating a note..."
create_response=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/notes" \
  -H 'content-type: application/json' \
  -d '{"title":"Smoke test note","body":"created by scripts/smoke.sh"}')
create_status=$(echo "$create_response" | tail -n1)
create_body=$(echo "$create_response" | sed '$d')
[ "$create_status" = "201" ] || fail "create returned $create_status: $create_body"
note_id=$(echo "$create_body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
[ -n "$note_id" ] || fail "create response had no id: $create_body"
echo "Created note $note_id"

echo "Listing notes..."
list_response=$(curl -s -w '\n%{http_code}' "${BASE_URL}/notes")
list_status=$(echo "$list_response" | tail -n1)
list_body=$(echo "$list_response" | sed '$d')
[ "$list_status" = "200" ] || fail "list returned $list_status: $list_body"
echo "$list_body" | grep -q "$note_id" || fail "list did not contain created note: $list_body"

echo "Updating the note..."
update_response=$(curl -s -w '\n%{http_code}' -X PUT "${BASE_URL}/notes/${note_id}" \
  -H 'content-type: application/json' \
  -d '{"title":"Smoke test note (updated)","body":"updated by scripts/smoke.sh"}')
update_status=$(echo "$update_response" | tail -n1)
update_body=$(echo "$update_response" | sed '$d')
[ "$update_status" = "200" ] || fail "update returned $update_status: $update_body"
echo "$update_body" | grep -q "Smoke test note (updated)" || fail "update did not persist: $update_body"

echo "Deleting the note..."
delete_status=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "${BASE_URL}/notes/${note_id}")
[ "$delete_status" = "204" ] || fail "delete returned $delete_status"

echo "Confirming the note is gone..."
get_status=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/notes/${note_id}")
[ "$get_status" = "404" ] || fail "note still reachable after delete: $get_status"

echo "OK: smoke check passed."
