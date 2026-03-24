"""
Database package — re-exports all public functions.

Usage:
    from db import init_db, save_vocab, list_lessons, ...
"""

# Connection & initialization
from .connection import init_db, get_db, get_connection

# SM-2 algorithm
from .sm2 import sm2_update

# Lessons & segments
from .lessons import (
    get_lesson_by_name,
    create_lesson,
    list_lessons,
    update_lesson_progress,
    delete_lesson_by_name,
    add_segments,
    get_segment,
    get_segment_transcript,
)

# Vocabulary
from .vocab import (
    save_vocab,
    update_vocab,
    list_vocab,
    delete_vocab,
    get_due_vocab,
    update_vocab_sm2,
)

# Grammar
from .grammar import (
    save_grammar,
    update_grammar,
    list_grammar,
    delete_grammar,
    get_due_grammar,
    update_grammar_sm2,
)

# Listening vocabulary
from .listening_vocab import (
    save_listening_vocab,
    list_listening_vocab,
    delete_listening_vocab,
    update_listening_vocab,
    get_due_listening_vocab,
    update_listening_vocab_sm2,
)
