from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import (
    save_vocab, list_vocab, delete_vocab, update_vocab,
    get_due_vocab, update_vocab_sm2
)

router = APIRouter(prefix="/vocab")

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

class ScrapeRequest(BaseModel):
    url: str

@router.post("")
def api_create_vocab(req: VocabCreateRequest):
    defs = [d.model_dump() for d in req.definitions]
    vocab = save_vocab(
        req.word, req.pronunciation, defs, req.general_meaning, req.audio_url
    )
    return vocab

@router.put("/{vocab_id}")
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

@router.post("/scrape")
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

@router.get("")
def api_list_vocab():
    return {"vocab": list_vocab()}

@router.delete("/{vocab_id}")
def api_delete_vocab(vocab_id: int):
    if not delete_vocab(vocab_id):
        raise HTTPException(status_code=404, detail="Vocab not found")
    return {"ok": True}

@router.get("/practice")
def api_vocab_practice():
    from datetime import date
    today = date.today().isoformat()
    items = get_due_vocab(today)
    return {"items": items, "total": len(items)}

@router.post("/practice/submit")
def api_vocab_practice_submit(req: PracticeSubmitRequest):
    if req.quality not in (0, 1, 2, 3, 5):
        raise HTTPException(status_code=400, detail="Quality must be 0, 1, 2, 3, or 5")
    result = update_vocab_sm2(req.vocab_id, req.quality)
    if result is None:
        raise HTTPException(status_code=404, detail="Vocab not found")
    return result
