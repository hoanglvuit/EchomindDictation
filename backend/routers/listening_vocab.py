from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import (
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
    """Scrape audio URL from Oxford Learners Dictionary page, including multiple POS."""
    import requests
    import re
    from bs4 import BeautifulSoup

    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.get(req.url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

    def extract_data(soup):
        # Find POS
        pos_elem = soup.find("span", class_="pos")
        pos = pos_elem.text if pos_elem else "unknown"
        
        # Find Audio
        audio_div = soup.find("div", class_="sound audio_play_button pron-us icon-audio")
        if not audio_div:
            audio_div = soup.find("div", class_="sound audio_play_button icon-audio")
            
        audio_url = None
        if audio_div:
            audio_url = audio_div.get("data-src-mp3") or audio_div.get("data-src-ogg")
            
        return pos, audio_url

    results = []
    
    # Parse first page
    soup = BeautifulSoup(response.text, "html.parser")
    pos, au = extract_data(soup)
    if au:
        results.append({"pos": pos, "audio_url": au})
        
    # Check for subsequent pages (e.g. _2, _3)
    current_url = response.url
    match = re.search(r'_(\d+)$', current_url)
    if match:
        base_url = current_url[:match.start()]
        next_idx = int(match.group(1)) + 1
    else:
        # Sometimes it might not redirect to _1 but still have a _2? Unlikely for Oxford, but let's be safe
        base_url = current_url
        next_idx = 2

    # Loop to get _2, _3, etc.
    while True:
        next_url = f"{base_url}_{next_idx}"
        try:
            r2 = requests.get(next_url, headers=headers, timeout=5)
            if r2.status_code != 200:
                break
            
            s2 = BeautifulSoup(r2.text, "html.parser")
            # If the page doesn't have a headword, it might be a generic 404 or redirect page
            if not s2.find(class_="headword"):
                break
                
            p2, au2 = extract_data(s2)
            if au2:
                results.append({"pos": p2, "audio_url": au2})
            next_idx += 1
        except Exception:
            break

    return {"audios": results}


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
