"""
Lesson & segment database helpers.
"""

from datetime import datetime
from .connection import get_db


# ── Lesson helpers ──────────────────────────────────────────


def get_lesson_by_name(name: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM lesson WHERE name = ?", (name,)).fetchone()
        return dict(row) if row else None


def create_lesson(name: str, original_filename: str, segment_count: int) -> dict:
    now = datetime.now().isoformat()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO lesson (name, original_filename, created_at, segment_count) VALUES (?, ?, ?, ?)",
            (name, original_filename, now, segment_count),
        )
        return {
            "id": cur.lastrowid,
            "name": name,
            "original_filename": original_filename,
            "created_at": now,
            "segment_count": segment_count,
        }


def list_lessons() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM lesson ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


def update_lesson_progress(name: str, progress: int) -> bool:
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE lesson SET progress = ? WHERE name = ?",
            (progress, name),
        )
        return cur.rowcount > 0


def delete_lesson_by_name(name: str) -> bool:
    with get_db() as conn:
        row = conn.execute("SELECT id FROM lesson WHERE name = ?", (name,)).fetchone()
        if not row:
            return False
        lesson_id = row["id"]
        conn.execute("DELETE FROM segment WHERE lesson_id = ?", (lesson_id,))
        cur = conn.execute("DELETE FROM lesson WHERE id = ?", (lesson_id,))
        return cur.rowcount > 0


# ── Segment helpers ─────────────────────────────────────────


def add_segments(lesson_id: int, segments: list[dict]):
    with get_db() as conn:
        conn.executemany(
            """INSERT INTO segment
               (lesson_id, segment_index, filename, start_time, end_time, transcript)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                (
                    lesson_id,
                    s["id"],
                    s["filename"],
                    s["start_time"],
                    s["end_time"],
                    s["transcript"],
                )
                for s in segments
            ],
        )


def get_segment(lesson_name: str, segment_index: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            """SELECT s.* FROM segment s
               JOIN lesson l ON s.lesson_id = l.id
               WHERE l.name = ? AND s.segment_index = ?""",
            (lesson_name, segment_index),
        ).fetchone()
        return dict(row) if row else None


def get_segment_transcript(lesson_name: str, segment_index: int) -> str | None:
    seg = get_segment(lesson_name, segment_index)
    return seg["transcript"] if seg else None
