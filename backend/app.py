"""
English Listening Dictation — FastAPI Backend
Models are loaded on-demand and unloaded after processing to save RAM.
"""

import os
import re
import gc
import tempfile


from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import (
    init_db,
    get_lesson_by_name,
    create_lesson,
    list_lessons,
    update_lesson_progress,
    delete_lesson_by_name,
)
from database import add_segments, get_segment, get_segment_transcript
from database import save_vocab, list_vocab, delete_vocab, update_vocab
from database import get_due_vocab, update_vocab_sm2


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


class HintRequest(BaseModel):
    session_name: str
    segment_id: int
    user_text: str = ""


class VocabDefinitionIn(BaseModel):
    definition: str = ""
    example: str = ""
    patterns: list[str] = []


class VocabCreateRequest(BaseModel):
    word: str
    pronunciation: str = ""
    general_meaning: str = ""
    audio_url: str | None = None
    definitions: list[VocabDefinitionIn] = []


class PracticeSubmitRequest(BaseModel):
    vocab_id: int
    quality: int  # 0, 1, 2, 3, or 5


# ── Lesson / Session routes ─────────────────────────────────


@app.get("/sessions")
def api_list_sessions():
    lessons = list_lessons()
    return {
        "sessions": [
            {
                "name": lesson["name"],
                "original_filename": lesson["original_filename"],
                "created_at": lesson["created_at"],
                "segment_count": lesson["segment_count"],
                "progress": lesson.get("progress", 0),
            }
            for lesson in lessons
        ]
    }


@app.get("/load/{session_name}")
def api_load_session(session_name: str):
    lesson = get_lesson_by_name(session_name)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_name": session_name,
        "total": lesson["segment_count"],
        "progress": lesson.get("progress", 0),
    }


class ProgressRequest(BaseModel):
    session_name: str
    segment_index: int


@app.post("/progress")
def api_save_progress(req: ProgressRequest):
    if not update_lesson_progress(req.session_name, req.segment_index):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@app.delete("/sessions/{session_name}")
def api_delete_session(session_name: str):
    # Remove from database
    if not delete_lesson_by_name(session_name):
        raise HTTPException(status_code=404, detail="Session not found")

    # Remove files
    session_dir = os.path.join(SESSIONS_DIR, session_name)
    if os.path.isdir(session_dir):
        import shutil

        try:
            shutil.rmtree(session_dir)
        except Exception as e:
            print(f"Error deleting directory {session_dir}: {e}")

    return {"ok": True}


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
        "transcript": seg["transcript"],
    }


@app.get("/audio/{session_name}/{filename}")
def api_serve_audio(session_name: str, filename: str):
    file_path = os.path.join(SESSIONS_DIR, session_name, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/wav")


@app.post("/upload")
async def api_upload(
    audio: UploadFile = File(...),
    vad_max: float = 1.0,
    vad_min: float = 0.01,
    vad_k: float = 2.0,
    vad_t0: float = 2.5,
    vad_threshold: float = 0.25,
):
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
            tmp.name,
            VAD_MODEL_PATH,
            asr_model,
            token_table,
            session_dir,
            vad_max,
            vad_min,
            vad_k,
            vad_t0,
            vad_threshold,
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


@app.post("/hint")
def api_hint(req: HintRequest):
    transcript = get_segment_transcript(req.session_name, req.segment_id)
    if transcript is None:
        raise HTTPException(status_code=400, detail="Invalid session or segment")

    norm_user = normalize_text(req.user_text)
    norm_expected = normalize_text(transcript)

    # Find where the user left off
    prefix_len = 0
    for a, b in zip(norm_expected, norm_user):
        if a == b:
            prefix_len += 1
        else:
            break

    # Get the part of the transcript remaining after the correct prefix
    remaining = norm_expected[prefix_len:].lstrip()
    if not remaining:
        return {"hint": None}

    # The hint is the next word
    next_word = remaining.split()[0]
    return {"hint": next_word}

    # ── Vocab routes ────────────────────────────────────────────


@app.post("/vocab")
def api_create_vocab(req: VocabCreateRequest):
    defs = [d.model_dump() for d in req.definitions]
    vocab = save_vocab(
        req.word, req.pronunciation, defs, req.general_meaning, req.audio_url
    )
    return vocab


@app.put("/vocab/{vocab_id}")
def api_update_vocab(vocab_id: int, req: VocabCreateRequest):
    defs = [d.model_dump() for d in req.definitions]
    if not update_vocab(
        vocab_id,
        req.word,
        req.pronunciation,
        defs,
        req.general_meaning,
        req.audio_url,
    ):
        raise HTTPException(status_code=404, detail="Vocab not found")
    return {"ok": True}


class ScrapeRequest(BaseModel):
    url: str


@app.post("/vocab/scrape")
def api_scrape_oxford(req: ScrapeRequest):
    import requests
    from bs4 import BeautifulSoup

    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.get(req.url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

    soup = BeautifulSoup(response.text, "html.parser")

    # Try US audio first
    audio_div = soup.find("div", class_="sound audio_play_button pron-us icon-audio")
    if not audio_div:
        # Fallback to any audio
        audio_div = soup.find("div", class_="sound audio_play_button icon-audio")

    mp3_url = None
    if audio_div:
        mp3_url = audio_div.get("data-src-mp3")
        if not mp3_url:
            mp3_url = audio_div.get("data-src-ogg")

    phonetic = None
    if audio_div:
        phon_span = audio_div.find_next_sibling("span", class_="phon")
        if phon_span:
            phonetic = phon_span.text.strip()

    if not phonetic:
        # Try finding any phonetic span
        phon_span = soup.find("span", class_="phon")
        if phon_span:
            phonetic = phon_span.text.strip()

    return {"audio_url": mp3_url, "phonetic": phonetic}


@app.get("/vocab")
def api_list_vocab():
    return {"vocab": list_vocab()}


@app.delete("/vocab/{vocab_id}")
def api_delete_vocab(vocab_id: int):
    if not delete_vocab(vocab_id):
        raise HTTPException(status_code=404, detail="Vocab not found")
    return {"ok": True}


# ── Vocab Practice (SM-2) routes ────────────────────────────


@app.get("/vocab/practice")
def api_vocab_practice():
    from datetime import date

    today = date.today().isoformat()
    items = get_due_vocab(today)
    return {"items": items, "total": len(items)}


@app.post("/vocab/practice/submit")
def api_vocab_practice_submit(req: PracticeSubmitRequest):
    if req.quality not in (0, 1, 2, 3, 5):
        raise HTTPException(status_code=400, detail="Quality must be 0, 1, 2, 3, or 5")
    result = update_vocab_sm2(req.vocab_id, req.quality)
    if result is None:
        raise HTTPException(status_code=404, detail="Vocab not found")
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
