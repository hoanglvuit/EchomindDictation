"""
SQLite database layer for English Listening Dictation.
Tables: lesson, segment, vocab, vocab_definition.
"""

import os
import sqlite3
from datetime import datetime
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS lesson (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT UNIQUE NOT NULL,
    original_filename TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    segment_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS segment (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id       INTEGER NOT NULL REFERENCES lesson(id),
    segment_index   INTEGER NOT NULL,
    filename        TEXT NOT NULL,
    start_time      TEXT NOT NULL,
    end_time        TEXT NOT NULL,
    transcript      TEXT NOT NULL,
    UNIQUE(lesson_id, segment_index)
);

CREATE TABLE IF NOT EXISTS vocab (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word            TEXT NOT NULL,
    pronunciation   TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vocab_definition (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vocab_id        INTEGER NOT NULL REFERENCES vocab(id) ON DELETE CASCADE,
    definition      TEXT NOT NULL DEFAULT '',
    example         TEXT NOT NULL DEFAULT ''
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)


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
        rows = conn.execute(
            "SELECT * FROM lesson ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


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


# ── Vocab helpers ───────────────────────────────────────────


def save_vocab(word: str, pronunciation: str, definitions: list[dict]) -> dict:
    now = datetime.now().isoformat()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO vocab (word, pronunciation, created_at) VALUES (?, ?, ?)",
            (word, pronunciation, now),
        )
        vocab_id = cur.lastrowid
        for d in definitions:
            conn.execute(
                "INSERT INTO vocab_definition (vocab_id, definition, example) VALUES (?, ?, ?)",
                (vocab_id, d.get("definition", ""), d.get("example", "")),
            )
        return {"id": vocab_id, "word": word, "pronunciation": pronunciation, "created_at": now}


def list_vocab() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM vocab ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            v = dict(row)
            defs = conn.execute(
                "SELECT id, definition, example FROM vocab_definition WHERE vocab_id = ?",
                (v["id"],),
            ).fetchall()
            v["definitions"] = [dict(d) for d in defs]
            result.append(v)
        return result


def delete_vocab(vocab_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM vocab WHERE id = ?", (vocab_id,))
        return cur.rowcount > 0
