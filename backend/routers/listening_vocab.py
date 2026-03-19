from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import (
    save_listening_vocab, list_listening_vocab, delete_listening_vocab,
    update_listening_vocab, get_due_listening_vocab, update_listening_vocab_sm2
)

router = APIRouter(prefix="/listening-vocab")


class ListeningVocabCreateRequest(BaseModel):
    word: str
    audio_url: str | None = None


class ListeningVocabUpdateRequest(BaseModel):
    word: str
    audio_url: str | None = None


class PracticeSubmitRequest(BaseModel):
    id: int
    quality: int  # 0-5


class ScrapeRequest(BaseModel):
    url: str


@router.post("")
def api_create_listening_vocab(req: ListeningVocabCreateRequest):
    vocab = save_listening_vocab(req.word, req.audio_url)
    return vocab


@router.get("")
def api_list_listening_vocab():
    return {"items": list_listening_vocab()}


@router.put("/{lv_id}")
def api_update_listening_vocab(lv_id: int, req: ListeningVocabUpdateRequest):
    if not update_listening_vocab(lv_id, req.word, req.audio_url):
        raise HTTPException(status_code=404, detail="Listening vocab not found")
    return {"ok": True}


@router.delete("/{lv_id}")
def api_delete_listening_vocab(lv_id: int):
    if not delete_listening_vocab(lv_id):
        raise HTTPException(status_code=404, detail="Listening vocab not found")
    return {"ok": True}


@router.post("/scrape")
def api_scrape_listening_vocab(req: ScrapeRequest):
    """Scrape audio URL from Oxford Learners Dictionary page."""
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
        audio_div = soup.find("div", class_="sound audio_play_button icon-audio")

    mp3_url = None
    if audio_div:
        mp3_url = audio_div.get("data-src-mp3")
        if not mp3_url:
            mp3_url = audio_div.get("data-src-ogg")

    return {"audio_url": mp3_url}


@router.get("/practice")
def api_listening_practice():
    from datetime import date
    today = date.today().isoformat()
    items = get_due_listening_vocab(today)
    return {"items": items, "total": len(items)}


@router.post("/practice/submit")
def api_listening_practice_submit(req: PracticeSubmitRequest):
    if req.quality not in (0, 1, 2, 3, 4, 5):
        raise HTTPException(status_code=400, detail="Quality must be 0-5")
    result = update_listening_vocab_sm2(req.id, req.quality)
    if result is None:
        raise HTTPException(status_code=404, detail="Listening vocab not found")
    return result
