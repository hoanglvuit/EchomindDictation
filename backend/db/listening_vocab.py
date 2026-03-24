"""
Listening vocabulary database helpers with SM-2 spaced repetition.
"""

from datetime import datetime, date, timedelta

from .connection import get_db
from .sm2 import sm2_update


def save_listening_vocab(word: str, audio_url: str | None = None) -> dict:
    now = datetime.now().isoformat()
    today = date.today()
    next_review = (today + timedelta(days=1)).isoformat()

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO listening_vocab (word, audio_url, created_at, next_review) VALUES (?, ?, ?, ?)",
            (word, audio_url, now, next_review),
        )
        return {
            "id": cur.lastrowid,
            "word": word,
            "audio_url": audio_url,
            "created_at": now,
            "next_review": next_review,
        }


def list_listening_vocab() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM listening_vocab ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_listening_vocab(vocab_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM listening_vocab WHERE id = ?", (vocab_id,))
        return cur.rowcount > 0


def update_listening_vocab(
    lv_id: int,
    word: str,
    audio_url: str | None = None,
) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT next_review, audio_url FROM listening_vocab WHERE id = ?", (lv_id,)
        ).fetchone()
        if not row:
            return False

        current_next_review = row["next_review"]
        old_audio = row["audio_url"]

        query = "UPDATE listening_vocab SET word = ?, audio_url = ?"
        params = [word, audio_url]

        # If adding audio for the first time, set next_review
        if not current_next_review and audio_url and not old_audio:
            next_review = (date.today() + timedelta(days=1)).isoformat()
            query += ", next_review = ?"
            params.append(next_review)

        query += " WHERE id = ?"
        params.append(lv_id)

        cur = conn.execute(query, tuple(params))
        return cur.rowcount > 0


def get_due_listening_vocab(today_str: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT * FROM listening_vocab
               WHERE next_review != '' AND next_review <= ?
               ORDER BY next_review ASC""",
            (today_str,),
        ).fetchall()
        return [dict(r) for r in rows]


def update_listening_vocab_sm2(vocab_id: int, quality: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM listening_vocab WHERE id = ?", (vocab_id,)
        ).fetchone()
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
            """UPDATE listening_vocab
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
