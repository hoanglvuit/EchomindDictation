import requests
from bs4 import BeautifulSoup
import json

def test_scrape(word):
    url = f"https://dictionary.cambridge.org/dictionary/english/{word}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    res = requests.get(url, headers=headers)
    print(f"Status for {word}:", res.status_code)
    
    soup = BeautifulSoup(res.text, "html.parser")
    results = []
    
    pos_headers = soup.find_all("div", class_="pos-header dpos-h")
    for header in pos_headers:
        pos_span = header.find("span", class_="pos dpos")
        pos = pos_span.text if pos_span else "unknown"
        
        audios = header.find_all("audio")
        for audio in audios:
            source = audio.find("source", type="audio/mpeg")
            if source and source.get("src"):
                src = source.get("src")
                if src.startswith("/"):
                    src = "https://dictionary.cambridge.org" + src
                results.append({"pos": pos, "audio_url": src})
                
    return results

print(json.dumps(test_scrape("proof"), indent=2))
print(json.dumps(test_scrape("present"), indent=2))
