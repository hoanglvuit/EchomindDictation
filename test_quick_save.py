import os
import sys
from datetime import date, timedelta

# Add current directory to path so we can import database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from backend.database import (
    save_vocab,
    update_vocab,
    get_due_vocab,
    init_db,
    delete_vocab,
)


def test_quick_save():
    init_db()

    word = "test_word_quick_save"
    print(f"Testing with word: {word}")

    # 1. Save without definitions (Quick Save)
    vocab = save_vocab(word, "", [])
    vocab_id = vocab["id"]
    print(
        f"Quick-saved vocab ID: {vocab_id}, next_review: '{vocab.get('next_review', 'N/A')}'"
    )

    if vocab.get("next_review") != "":
        print("FAILED: Quick-save should have empty next_review")
        return False

    # 2. Check if it's in due vocab
    today = date.today().isoformat()
    due = get_due_vocab(today)
    is_due = any(v["id"] == vocab_id for v in due)
    print(f"Is in due vocab? {is_due}")

    if is_due:
        print("FAILED: Quick-saved word should NOT be in due vocab")
        return False

    # 3. Update with definition
    print("Updating with definition...")
    update_vocab(vocab_id, word, "", [{"definition": "test definition"}])

    # 4. Check if next_review is now set
    # Need to reload or check DB
    from backend.database import get_db

    with get_db() as conn:
        row = conn.execute(
            "SELECT next_review FROM vocab WHERE id = ?", (vocab_id,)
        ).fetchone()
        new_next_review = row["next_review"]
        print(f"New next_review: {new_next_review}")

    if not new_next_review:
        print("FAILED: next_review should be set after adding definition")
        return False

    # 5. Check if it's in due vocab (it's set to tomorrow, so maybe not due TODAY)
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    due_tomorrow = get_due_vocab(tomorrow)
    is_due_tomorrow = any(v["id"] == vocab_id for v in due_tomorrow)
    print(f"Is in due tomorrow vocab? {is_due_tomorrow}")

    if not is_due_tomorrow:
        print("FAILED: Word should be in due tomorrow vocab after adding definition")
        return False

    # Cleanup
    delete_vocab(vocab_id)
    print("Test PASSED!")
    return True


if __name__ == "__main__":
    if test_quick_save():
        sys.exit(0)
    else:
        sys.exit(1)
