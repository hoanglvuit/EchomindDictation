"""
English Listening Dictation — FastAPI Backend
Models are loaded on-demand and unloaded after processing to save RAM.
"""




from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db

from routers import sessions, vocab, evaluation

@asynccontextmanager
async def lifespan(app):
    init_db()
    print("Database initialized. Server ready. Models will load on first upload.")
    yield

app = FastAPI(title="English Listening Dictation", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(vocab.router)
app.include_router(evaluation.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
