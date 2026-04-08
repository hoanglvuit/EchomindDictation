from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date
from db import (
    save_grammar, list_grammar, delete_grammar, update_grammar,
    get_due_grammar, update_grammar_sm2
)

router = APIRouter(prefix="/grammar")

class GrammarCreateRequest(BaseModel):
    structure: str
    meaning: str
    examples: list[str] = []

class PracticeSubmitRequest(BaseModel):
    grammar_id: int
    quality: int  # 0, 1, 2, 3, or 5

@router.post("")
def api_create_grammar(req: GrammarCreateRequest):
    grammar = save_grammar(
        req.structure, req.meaning, req.examples
    )
    return grammar

@router.put("/{grammar_id}")
def api_update_grammar(grammar_id: int, req: GrammarCreateRequest):
    if not update_grammar(
        grammar_id,
        req.structure,
        req.meaning,
        req.examples,
    ):
        raise HTTPException(status_code=404, detail="Grammar not found")
    return {"ok": True}

@router.get("")
def api_list_grammar():
    return {"grammar": list_grammar()}

@router.delete("/{grammar_id}")
def api_delete_grammar(grammar_id: int):
    if not delete_grammar(grammar_id):
        raise HTTPException(status_code=404, detail="Grammar not found")
    return {"ok": True}

@router.get("/practice")
def api_grammar_practice():
    today = date.today().isoformat()
    items = get_due_grammar(today)
    return {"items": items, "total": len(items)}

@router.post("/practice/submit")
def api_grammar_practice_submit(req: PracticeSubmitRequest):
    if req.quality not in (0, 1, 2, 3, 5):
        raise HTTPException(status_code=400, detail="Quality must be 0, 1, 2, 3, or 5")
    result = update_grammar_sm2(req.grammar_id, req.quality)
    if result is None:
        raise HTTPException(status_code=404, detail="Grammar not found")
    return result
