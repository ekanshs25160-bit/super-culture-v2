import sys
import os
from pathlib import Path

# Add backend directory to sys.path so app is always importable
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Fix relative import when running directly via `python3 app/main.py`
if __name__ == "__main__" and not __package__:
    __package__ = "app"

# Ensure Memori and ytmusicapi repository paths are available if present
memori_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Memori"))
if os.path.exists(memori_path) and memori_path not in sys.path:
    sys.path.append(memori_path)

ytmusic_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../ytmusicapi"))
if os.path.exists(ytmusic_path) and ytmusic_path not in sys.path:
    sys.path.append(ytmusic_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .yt_service import yt_service, search_tracks
from .jam_router import router as jam_router
from .ai_router import router as ai_router

app = FastAPI()

app.include_router(jam_router)
app.include_router(ai_router)

# Allow frontend origins
origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/search")
def search(q: str, limit: int = 40):
    return search_tracks(q, limit)

@app.get("/api/playlists")
def get_playlists():
    return yt_service.get_playlists()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
