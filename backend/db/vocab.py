"""
Vocabulary database helpers with SM-2 spaced repetition.
"""

import json
import random
from datetime import datetime, date, timedelta
from typing import Optional

from .connection import get_db
from .sm2 import sm2_update


def save_vocab(
    word: str,
    pronunciation: str,
    definitions: list[dict],
    general_meaning: str = "",
    audio_url: Optional[str] = None,
) -> dict:
    now = datetime.now().isoformat()
    has_definitions = any(d.get("definition", "").strip() for d in definitions)

    if has_definitions:
        today = date.today()
        next_review = (today + timedelta(days=1)).isoformat()
    else:
        next_review = ""

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO vocab (word, pronunciation, general_meaning, created_at, next_review, audio_url) VALUES (?, ?, ?, ?, ?, ?)",
            (word, pronunciation, general_meaning, now, next_review, audio_url),
        )
        vocab_id = cur.lastrowid
        for d in definitions:
            patterns_json = json.dumps(d.get("patterns", []))
            conn.execute(
                "INSERT INTO vocab_definition (vocab_id, definition, example, patterns) VALUES (?, ?, ?, ?)",
                (
                    vocab_id,
                    d.get("definition", ""),
                    d.get("example", ""),
                    patterns_json,
                ),
            )
        return {
            "id": vocab_id,
            "word": word,
            "pronunciation": pronunciation,
            "general_meaning": general_meaning,
            "created_at": now,
            "next_review": next_review,
        }


def update_vocab(
    vocab_id: int,
    word: str,
    pronunciation: str,
    definitions: list[dict],
    general_meaning: str = "",
    audio_url: Optional[str] = None,
) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT next_review FROM vocab WHERE id = ?", (vocab_id,)
        ).fetchone()
        if not row:
            return False

        current_next_review = row["next_review"]
        has_new_definitions = any(d.get("definition", "").strip() for d in definitions)

        update_fields = [word, pronunciation, general_meaning, audio_url]
        query = "UPDATE vocab SET word = ?, pronunciation = ?, general_meaning = ?, audio_url = ?"

        if not current_next_review and has_new_definitions:
            today = date.today()
            next_review = (today + timedelta(days=1)).isoformat()
            query += ", next_review = ?"
            update_fields.append(next_review)

        query += " WHERE id = ?"
        update_fields.append(vocab_id)

        cur = conn.execute(query, tuple(update_fields))
        if cur.rowcount == 0:
            return False

        conn.execute("DELETE FROM vocab_definition WHERE vocab_id = ?", (vocab_id,))
        for d in definitions:
            patterns_json = json.dumps(d.get("patterns", []))
            conn.execute(
                "INSERT INTO vocab_definition (vocab_id, definition, example, patterns) VALUES (?, ?, ?, ?)",
                (
                    vocab_id,
                    d.get("definition", ""),
                    d.get("example", ""),
                    patterns_json,
                ),
            )
        return True


def list_vocab() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM vocab ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            v = dict(row)
            defs = conn.execute(
                "SELECT id, definition, example, patterns FROM vocab_definition WHERE vocab_id = ?",
                (v["id"],),
            ).fetchall()
            v["definitions"] = []
            for d in defs:
                d_dict = dict(d)
                try:
                    d_dict["patterns"] = json.loads(d_dict.get("patterns", "[]"))
                except (json.JSONDecodeError, TypeError):
                    d_dict["patterns"] = []
                v["definitions"].append(d_dict)
            result.append(v)
        return result


def delete_vocab(vocab_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM vocab WHERE id = ?", (vocab_id,))
        return cur.rowcount > 0


def get_vocab_count() -> int:
    """Total number of vocab entries in DB."""
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM vocab").fetchone()
        return row["cnt"]


def _get_random_definitions(conn, exclude_vocab_id: int, count: int) -> list[dict]:
    """Get `count` random vocab entries (with definitions) excluding one vocab_id."""
    rows = conn.execute(
        """SELECT v.id, v.word FROM vocab v
           WHERE v.id != ?
           AND EXISTS (
               SELECT 1 FROM vocab_definition vd
               WHERE vd.vocab_id = v.id AND vd.definition != ''
           )
           ORDER BY RANDOM() LIMIT ?""",
        (exclude_vocab_id, count),
    ).fetchall()
    return [dict(r) for r in rows]


def get_due_vocab(today_str: str) -> list[dict]:
    """
    Get all vocab items due for review on or before `today_str` (YYYY-MM-DD).
    Each item includes: word info, definitions, quiz_type ('mcq' or 'spelling').
    MCQ items also include `options` (list of 4 word choices, shuffled).
    """
    with get_db() as conn:
        rows = conn.execute(
            """SELECT v.* FROM vocab v
               WHERE v.next_review != '' AND v.next_review <= ?
               ORDER BY v.next_review ASC""",
            (today_str,),
        ).fetchall()

        total_vocab = get_vocab_count()
        result = []

        for row in rows:
            v = dict(row)
            defs = conn.execute(
                "SELECT id, definition, example, patterns FROM vocab_definition WHERE vocab_id = ?",
                (v["id"],),
            ).fetchall()
            v["definitions"] = []
            for d in defs:
                d_dict = dict(d)
                try:
                    d_dict["patterns"] = json.loads(d_dict.get("patterns", "[]"))
                except (json.JSONDecodeError, TypeError):
                    d_dict["patterns"] = []
                v["definitions"].append(d_dict)

            has_definition = any(d["definition"].strip() for d in v["definitions"])
            if not has_definition:
                continue

            all_defs = [
                d["definition"] for d in v["definitions"] if d["definition"].strip()
            ]

            if v["repetition"] < 2 and total_vocab >= 4:
                v["quiz_type"] = "mcq"
                distractors = _get_random_definitions(conn, v["id"], 3)
                if len(distractors) < 3:
                    v["quiz_type"] = "spelling"
                else:
                    options = [{"word": v["word"], "correct": True}]
                    for dist in distractors:
                        options.append({"word": dist["word"], "correct": False})
                    random.shuffle(options)
                    v["options"] = options
                    v["question_definitions"] = all_defs
            else:
                v["quiz_type"] = "spelling"
                v["question_definitions"] = all_defs

            result.append(v)

        return result


def update_vocab_sm2(vocab_id: int, quality: int) -> dict | None:
    """
    Apply SM-2 update to a vocab item.
    quality: 0, 3, or 5
    Returns updated vocab info or None if not found.
    """
    with get_db() as conn:
        row = conn.execute("SELECT * FROM vocab WHERE id = ?", (vocab_id,)).fetchone()
        if not row:
            return None
        v = dict(row)

        new_ef, new_rep, new_interval = sm2_update(
            quality=quality,
            easiness_factor=v["easiness_factor"],
            repetition=v["repetition"],
            interval_days=v["interval_days"],
        )

        new_next_review = (date.today() + timedelta(days=new_interval)).isoformat()

        conn.execute(
            """UPDATE vocab
               SET easiness_factor = ?, repetition = ?,
                   interval_days = ?, next_review = ?
               WHERE id = ?""",
            (new_ef, new_rep, new_interval, new_next_review, vocab_id),
        )

        return {
            "id": vocab_id,
            "word": v["word"],
            "easiness_factor": round(new_ef, 2),
            "repetition": new_rep,
            "interval_days": new_interval,
            "next_review": new_next_review,
        }
