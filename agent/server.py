"""The HTTP door to the agent: the chat panel posts here."""

import os

from agent import run_agent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

app = FastAPI(title="Kwiktots Agent")

# The page comes from another port, so the browser only lets it call us if we allow it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


# Plain def, not async def: run_agent blocks while it waits, so FastAPI runs it
# in a separate thread and the server stays free.
@app.post("/agent/chat")
def chat(request: ChatRequest) -> dict[str, str]:
    return {"reply": run_agent(request.message)}
