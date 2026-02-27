"""
English Listening Dictation — FastAPI Backend
Models are loaded on-demand and unloaded after processing to save RAM.
"""

import os
import re
import gc
import tempfile
from datetime import datetime
from typing import Optional

from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import init_db, get_lesson_by_name, create_lesson, list_lessons
from database import add_segments, get_segment, get_segment_transcript
from database import save_vocab, list_vocab, delete_vocab


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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

MODEL_DIR = os.path.join(BASE_DIR, "model")
VAD_MODEL_PATH = os.path.join(MODEL_DIR, "vad", "silero_vad.onnx")
ASR_DIR = os.path.join(MODEL_DIR, "asr")


# ── Text normalization ──────────────────────────────────────


def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def sanitize_name(name: str) -> str:
    name = os.path.splitext(name)[0]
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    return name.strip(". ") or "untitled"


# ── Pydantic models ────────────────────────────────────────


class CheckRequest(BaseModel):
    session_name: str
    segment_id: int
    user_text: str = ""


class AnswerRequest(BaseModel):
    session_name: str
    segment_id: int


class VocabDefinitionIn(BaseModel):
    definition: str = ""
    example: str = ""


class VocabCreateRequest(BaseModel):
    word: str
    pronunciation: str = ""
    definitions: list[VocabDefinitionIn] = []


# ── Lesson / Session routes ─────────────────────────────────


@app.get("/sessions")
def api_list_sessions():
    lessons = list_lessons()
    return {
        "sessions": [
            {
                "name": l["name"],
                "original_filename": l["original_filename"],
                "created_at": l["created_at"],
                "segment_count": l["segment_count"],
            }
            for l in lessons
        ]
    }


@app.get("/load/{session_name}")
def api_load_session(session_name: str):
    lesson = get_lesson_by_name(session_name)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_name": session_name, "total": lesson["segment_count"]}


@app.get("/segment/{session_name}/{segment_id}")
def api_get_segment(session_name: str, segment_id: int):
    seg = get_segment(session_name, segment_id)
    if seg is None:
        raise HTTPException(status_code=400, detail="Invalid segment")
    return {
        "id": seg["segment_index"],
        "audio_url": f"/audio/{session_name}/{seg['filename']}",
        "start_time": seg["start_time"],
        "end_time": seg["end_time"],
    }


@app.get("/audio/{session_name}/{filename}")
def api_serve_audio(session_name: str, filename: str):
    file_path = os.path.join(SESSIONS_DIR, session_name, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/wav")


@app.post("/upload")
async def api_upload(audio: UploadFile = File(...)):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    session_name = sanitize_name(audio.filename)

    # Already processed?
    existing = get_lesson_by_name(session_name)
    if existing:
        print(f"Session '{session_name}' already exists.")
        return {
            "session_name": session_name,
            "total": existing["segment_count"],
            "cached": True,
        }

    # Create session directory
    session_dir = os.path.join(SESSIONS_DIR, session_name)
    os.makedirs(session_dir, exist_ok=True)

    # Save to temp
    suffix = os.path.splitext(audio.filename)[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await audio.read()
    tmp.write(content)
    tmp.close()

    try:
        from asr_engine import WhisperOnnxModel, load_tokens, process_audio

        print("Loading models into RAM...")
        asr_model = WhisperOnnxModel(
            encoder_path=os.path.join(ASR_DIR, "distil-small.en-encoder.onnx"),
            decoder_path=os.path.join(ASR_DIR, "distil-small.en-decoder.onnx"),
        )
        token_table = load_tokens(os.path.join(ASR_DIR, "distil-small.en-tokens.txt"))
        print(f"Loaded {len(token_table)} tokens.")

        print(f"Processing: {audio.filename} -> session '{session_name}'")
        segments = process_audio(
            tmp.name, VAD_MODEL_PATH, asr_model, token_table, session_dir
        )

        del asr_model
        del token_table
        gc.collect()
        print("Models unloaded from RAM.")
    finally:
        os.unlink(tmp.name)

    # Save to database
    lesson = create_lesson(session_name, audio.filename, len(segments))
    add_segments(lesson["id"], segments)

    print(f"Done! {len(segments)} segments saved to sessions/{session_name}/")
    return {
        "session_name": session_name,
        "total": len(segments),
        "cached": False,
    }


# ── Check / Answer routes ──────────────────────────────────


@app.post("/check")
def api_check(req: CheckRequest):
    transcript = get_segment_transcript(req.session_name, req.segment_id)
    if transcript is None:
        raise HTTPException(status_code=400, detail="Invalid session or segment")

    norm_user = normalize_text(req.user_text)
    norm_expected = normalize_text(transcript)

    correct = norm_user == norm_expected
    result: dict = {"correct": correct}

    if correct:
        result["expected"] = transcript
    else:
        prefix_len = 0
        for a, b in zip(norm_expected, norm_user):
            if a == b:
                prefix_len += 1
            else:
                break
        result["matching_prefix"] = norm_expected[:prefix_len]

    return result


@app.post("/answer")
def api_answer(req: AnswerRequest):
    transcript = get_segment_transcript(req.session_name, req.segment_id)
    if transcript is None:
        raise HTTPException(status_code=400, detail="Invalid session or segment")
    return {"expected": transcript}


# ── Vocab routes ────────────────────────────────────────────


@app.post("/vocab")
def api_create_vocab(req: VocabCreateRequest):
    defs = [d.model_dump() for d in req.definitions]
    vocab = save_vocab(req.word, req.pronunciation, defs)
    return vocab


@app.get("/vocab")
def api_list_vocab():
    return {"vocab": list_vocab()}


@app.delete("/vocab/{vocab_id}")
def api_delete_vocab(vocab_id: int):
    if not delete_vocab(vocab_id):
        raise HTTPException(status_code=404, detail="Vocab not found")
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
