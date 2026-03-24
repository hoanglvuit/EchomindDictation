"""
Grammar database helpers with SM-2 spaced repetition.
"""

import random
from datetime import datetime, date, timedelta

from .connection import get_db
from .sm2 import sm2_update


def save_grammar(structure: str, meaning: str, examples: list[str]) -> dict:
    now = datetime.now().isoformat()
    today = date.today()
    next_review = (today + timedelta(days=1)).isoformat()

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO grammar (structure, meaning, created_at, next_review) VALUES (?, ?, ?, ?)",
            (structure, meaning, now, next_review),
        )
        grammar_id = cur.lastrowid
        for ex in examples:
            if ex.strip():
                conn.execute(
                    "INSERT INTO grammar_example (grammar_id, example) VALUES (?, ?)",
                    (grammar_id, ex.strip()),
                )
        return {
            "id": grammar_id,
            "structure": structure,
            "meaning": meaning,
            "next_review": next_review,
        }


def update_grammar(
    grammar_id: int, structure: str, meaning: str, examples: list[str]
) -> bool:
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE grammar SET structure = ?, meaning = ? WHERE id = ?",
            (structure, meaning, grammar_id),
        )
        if cur.rowcount == 0:
            return False
        conn.execute("DELETE FROM grammar_example WHERE grammar_id = ?", (grammar_id,))
        for ex in examples:
            if ex.strip():
                conn.execute(
                    "INSERT INTO grammar_example (grammar_id, example) VALUES (?, ?)",
                    (grammar_id, ex.strip()),
                )
        return True


def list_grammar() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM grammar ORDER BY created_at DESC"
        ).fetchall()
        result = []
        for row in rows:
            g = dict(row)
            exs = conn.execute(
                "SELECT example FROM grammar_example WHERE grammar_id = ?", (g["id"],)
            ).fetchall()
            g["examples"] = [e["example"] for e in exs]
            result.append(g)
        return result


def delete_grammar(grammar_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM grammar WHERE id = ?", (grammar_id,))
        return cur.rowcount > 0



def get_due_grammar(today_str: str) -> list[dict]:
    """
    Get all grammar items due for review.
    Returns items with quiz_type ('mcq' or 'spelling') and relevant data.
    """
    with get_db() as conn:
        rows = conn.execute(
            """SELECT * FROM grammar
               WHERE next_review != '' AND next_review <= ?
               ORDER BY next_review ASC""",
            (today_str,),
        ).fetchall()

        total = conn.execute("SELECT COUNT(*) as cnt FROM grammar").fetchone()["cnt"]
        result = []

        for row in rows:
            g = dict(row)
            exs = conn.execute(
                "SELECT example FROM grammar_example WHERE grammar_id = ?", (g["id"],)
            ).fetchall()
            g["examples"] = [e["example"] for e in exs]

            if g["repetition"] < 2 and total >= 4:
                g["quiz_type"] = "mcq"
                distractors = conn.execute(
                    """SELECT id, structure FROM grammar
                       WHERE id != ? ORDER BY RANDOM() LIMIT 3""",
                    (g["id"],),
                ).fetchall()
                if len(distractors) < 3:
                    g["quiz_type"] = "spelling"
                else:
                    options = [{"structure": g["structure"], "correct": True}]
                    for d_row in distractors:
                        options.append(
                            {"structure": d_row["structure"], "correct": False}
                        )
                    random.shuffle(options)
                    g["options"] = options
            else:
                g["quiz_type"] = "spelling"

            result.append(g)

        return result


def update_grammar_sm2(grammar_id: int, quality: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM grammar WHERE id = ?", (grammar_id,)
        ).fetchone()
        if not row:
            return None
        g = dict(row)

        new_ef, new_rep, new_interval = sm2_update(
            quality=quality,
            easiness_factor=g["easiness_factor"],
            repetition=g["repetition"],
            interval_days=g["interval_days"],
        )

        new_next_review = (date.today() + timedelta(days=new_interval)).isoformat()

        conn.execute(
            """UPDATE grammar
               SET easiness_factor = ?, repetition = ?,
                   interval_days = ?, next_review = ?
               WHERE id = ?""",
            (new_ef, new_rep, new_interval, new_next_review, grammar_id),
        )

        return {
            "id": grammar_id,
            "structure": g["structure"],
            "easiness_factor": round(new_ef, 2),
            "repetition": new_rep,
            "interval_days": new_interval,
            "next_review": new_next_review,
        }
