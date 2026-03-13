from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re
from database import get_segment_transcript

router = APIRouter()

def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

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

@router.post("/check")
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

@router.post("/answer")
def api_answer(req: AnswerRequest):
    transcript = get_segment_transcript(req.session_name, req.segment_id)
    if transcript is None:
        raise HTTPException(status_code=400, detail="Invalid session or segment")
    return {"expected": transcript}

@router.post("/hint")
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
