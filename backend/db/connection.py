"""
Database connection, schema, and migrations for English Listening Dictation.
"""

import os
import sqlite3
from datetime import date
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
    spelling_unlocked INTEGER NOT NULL DEFAULT 0,
    audio_url       TEXT
);

CREATE TABLE IF NOT EXISTS vocab_definition (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vocab_id        INTEGER NOT NULL REFERENCES vocab(id) ON DELETE CASCADE,
    definition      TEXT NOT NULL DEFAULT '',
    example         TEXT NOT NULL DEFAULT '',
    patterns        TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS grammar (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    structure       TEXT NOT NULL,
    meaning         TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    easiness_factor REAL NOT NULL DEFAULT 2.5,
    repetition      INTEGER NOT NULL DEFAULT 0,
    interval_days   INTEGER NOT NULL DEFAULT 0,
    next_review     TEXT NOT NULL DEFAULT '',
    spelling_unlocked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS grammar_example (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    grammar_id      INTEGER NOT NULL REFERENCES grammar(id) ON DELETE CASCADE,
    example         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS listening_vocab (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word            TEXT NOT NULL,
    audio_url       TEXT,
    created_at      TEXT NOT NULL,
    easiness_factor REAL NOT NULL DEFAULT 2.5,
    repetition      INTEGER NOT NULL DEFAULT 0,
    interval_days   INTEGER NOT NULL DEFAULT 0,
    next_review     TEXT NOT NULL DEFAULT ''
);
"""

MIGRATIONS = [
    "ALTER TABLE vocab ADD COLUMN easiness_factor REAL NOT NULL DEFAULT 2.5",
    "ALTER TABLE vocab ADD COLUMN repetition INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE vocab ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE vocab ADD COLUMN next_review TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE vocab ADD COLUMN progress INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE vocab ADD COLUMN audio_url TEXT",
    "ALTER TABLE vocab ADD COLUMN general_meaning TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE vocab_definition ADD COLUMN patterns TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE vocab ADD COLUMN spelling_unlocked INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE grammar ADD COLUMN spelling_unlocked INTEGER NOT NULL DEFAULT 0",
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
        for migration in MIGRATIONS:
            try:
                conn.execute(migration)
            except sqlite3.OperationalError:
                pass  # Column already exists
        # Backfill next_review for old vocab entries that have definitions
        today = date.today().isoformat()
        conn.execute(
            """UPDATE vocab SET next_review = ? 
               WHERE next_review = '' AND EXISTS (
                   SELECT 1 FROM vocab_definition vd 
                   WHERE vd.vocab_id = vocab.id AND vd.definition != ''
               )""",
            (today,),
        )
        # Backfill spelling_unlocked for existing entries
        conn.execute("UPDATE vocab SET spelling_unlocked = 1 WHERE repetition >= 2")
        conn.execute("UPDATE grammar SET spelling_unlocked = 1 WHERE repetition >= 2")
