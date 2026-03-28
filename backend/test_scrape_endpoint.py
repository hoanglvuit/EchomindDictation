from fastapi import HTTPException
from pydantic import BaseModel
import sys
import json
sys.path.append('.')

class ScrapeRequest(BaseModel):
    url: str

from routers.listening_vocab import api_scrape_listening_vocab

try:
    req = ScrapeRequest(url="https://dictionary.cambridge.org/dictionary/english/proof")
    res = api_scrape_listening_vocab(req)
    print(json.dumps(res, indent=2))
except Exception as e:
    print("Error:", e)
