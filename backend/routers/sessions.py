from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import os
import re
from pydantic import BaseModel
from db import (
    get_lesson_by_name,
    create_lesson,
    list_lessons,
    update_lesson_progress,
    delete_lesson_by_name,
    add_segments,
    get_segment
)

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")

def sanitize_name(name: str) -> str:
    name = os.path.splitext(name)[0]
    name = re.sub(r'[<>:"/\\|?*#]', "_", name)
    return name.strip(". ") or "untitled"

class ProgressRequest(BaseModel):
    session_name: str
    segment_index: int

@router.get("/sessions")
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

@router.get("/load/{session_name}")
def api_load_session(session_name: str):
    lesson = get_lesson_by_name(session_name)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_name": session_name,
        "total": lesson["segment_count"],
        "progress": lesson.get("progress", 0),
    }

@router.post("/progress")
def api_save_progress(req: ProgressRequest):
    if not update_lesson_progress(req.session_name, req.segment_index):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}

@router.delete("/sessions/{session_name}")
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

@router.get("/segment/{session_name}/{segment_id}")
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

@router.get("/audio/{session_name}/{filename}")
def api_serve_audio(session_name: str, filename: str):
    file_path = os.path.join(SESSIONS_DIR, session_name, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/wav")

@router.post("/upload")
async def api_upload(
    audio: UploadFile = File(...),
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

    # Save source audio to session directory
    suffix = os.path.splitext(audio.filename)[1].lower()
    source_audio_path = os.path.join(session_dir, f"source_audio{suffix}")
    
    with open(source_audio_path, "wb") as f:
        content = await audio.read()
        f.write(content)

    try:
        from asr_engine import process_audio
        print(f"Processing: {audio.filename} -> session '{session_name}'")
        segments = process_audio(
            source_audio_path,
            session_dir,
        )
    except Exception as e:
        print(f"Error during processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # Save to database
    lesson = create_lesson(session_name, audio.filename, len(segments))
    add_segments(lesson["id"], segments)

    print(f"Done! {len(segments)} segments saved to sessions/{session_name}/")
    return {
        "session_name": session_name,
        "total": len(segments),
        "cached": False,
    }
