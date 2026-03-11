"""
SQLite database layer for English Listening Dictation.
Tables: lesson, segment, vocab, vocab_definition.
Includes SM-2 spaced repetition fields on vocab.
"""

import os
import random
import json
import sqlite3
from datetime import datetime, date, timedelta
from typing import Optional
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS lesson (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT UNIQUE NOT NULL,
    original_filename TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    segment_count   INTEGER NOT NULL DEFAULT 0,
    progress        INTEGER NOT NULL DEFAULT 0
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
    general_meaning TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    easiness_factor REAL NOT NULL DEFAULT 2.5,
    repetition      INTEGER NOT NULL DEFAULT 0,
    interval_days   INTEGER NOT NULL DEFAULT 0,
    next_review     TEXT NOT NULL DEFAULT '',
    audio_url       TEXT
);

CREATE TABLE IF NOT EXISTS vocab_definition (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vocab_id        INTEGER NOT NULL REFERENCES vocab(id) ON DELETE CASCADE,
    definition      TEXT NOT NULL DEFAULT '',
    example         TEXT NOT NULL DEFAULT '',
    patterns        TEXT NOT NULL DEFAULT '[]'
);
"""

# Migrations for existing databases (safe to re-run)
MIGRATIONS = [
    "ALTER TABLE vocab ADD COLUMN easiness_factor REAL NOT NULL DEFAULT 2.5",
    "ALTER TABLE vocab ADD COLUMN repetition INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE vocab ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE vocab ADD COLUMN next_review TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE vocab ADD COLUMN progress INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE vocab ADD COLUMN audio_url TEXT",
    "ALTER TABLE vocab ADD COLUMN general_meaning TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE vocab_definition ADD COLUMN patterns TEXT NOT NULL DEFAULT '[]'",
]


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
        # Run migrations for existing databases
        for migration in MIGRATIONS:
            try:
                conn.execute(migration)
            except sqlite3.OperationalError:
                pass  # Column already exists
        # Backfill next_review for old vocab entries
        today = date.today().isoformat()
        conn.execute(
            "UPDATE vocab SET next_review = ? WHERE next_review = ''",
            (today,),
        )


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
        # Get lesson ID first
        row = conn.execute("SELECT id FROM lesson WHERE name = ?", (name,)).fetchone()
        if not row:
            return False
        lesson_id = row["id"]

        # Delete segments first
        conn.execute("DELETE FROM segment WHERE lesson_id = ?", (lesson_id,))
        # Delete lesson
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


# ── Vocab helpers ───────────────────────────────────────────


def save_vocab(
    word: str,
    pronunciation: str,
    definitions: list[dict],
    general_meaning: str = "",
    audio_url: Optional[str] = None,
) -> dict:

    now = datetime.now().isoformat()

    # Check if there's at least one non-empty definition
    has_definitions = any(d.get("definition", "").strip() for d in definitions)

    # If no definitions, next_review is empty (not due). Otherwise, tomorrow.
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
        # Get current state to see if we need to initialize next_review
        row = conn.execute(
            "SELECT next_review FROM vocab WHERE id = ?", (vocab_id,)
        ).fetchone()
        if not row:
            return False

        current_next_review = row["next_review"]

        # Check if we are adding definitions to a word that didn't have any
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

        # Replace definitions
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


# ── SM-2 Spaced Repetition ──────────────────────────────────


def sm2_update(
    quality: int,
    easiness_factor: float,
    repetition: int,
    interval_days: int,
) -> tuple[float, int, int]:
    """
    Apply SM-2 algorithm.
    quality: 0, 3, or 5  (mapped from user score 0, 1, 2)
    Returns: (new_ef, new_repetition, new_interval)
    """
    # Update easiness factor
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if quality >= 1:  # Correct (quality 1, 2, 3, or 5)
        if repetition == 0:
            new_interval = 1
        elif repetition == 1:
            new_interval = 6
        else:
            new_interval = max(1, round(interval_days * new_ef))
        new_repetition = repetition + 1
    else:  # Failed (quality 0)
        new_repetition = 0
        new_interval = 1

    return new_ef, new_repetition, new_interval


def get_vocab_count() -> int:
    """Total number of vocab entries in DB."""
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM vocab").fetchone()
        return row["cnt"]


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

            # Skip words with no definitions (can't quiz on them)
            has_definition = any(d["definition"].strip() for d in v["definitions"])
            if not has_definition:
                continue

            # Collect all non-empty definitions for the question
            all_defs = [
                d["definition"] for d in v["definitions"] if d["definition"].strip()
            ]

            # Assign quiz type:
            # - Repetition < 2: MCQ (if enough distractors)
            # - Repetition >= 2: Spelling
            if v["repetition"] < 2 and total_vocab >= 4:
                v["quiz_type"] = "mcq"
                distractors = get_random_definitions(conn, v["id"], 3)
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


def get_random_definitions(conn, exclude_vocab_id: int, count: int) -> list[dict]:
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
