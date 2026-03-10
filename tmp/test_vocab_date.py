import sys
import os
from datetime import date, timedelta

# Mocking database path for testing
os.environ["DB_PATH"] = ":memory:"

# Import from the project
sys.path.append(r"f:\Máy tính\english-listening\backend")
from database import init_db, save_vocab, get_connection


def test_vocab_creation_date():
    print("Testing Vocabulary Creation Date...")
    init_db()

    word = "testword"
    pron = "testpron"
    defs = [{"definition": "test definition", "example": "test example"}]

    vocab = save_vocab(word, pron, defs)

    with get_connection() as conn:
        conn.row_factory = None
        row = conn.execute(
            "SELECT next_review FROM vocab WHERE id = ?", (vocab["id"],)
        ).fetchone()
        next_review = row[0]

    expected_next_review = (date.today() + timedelta(days=1)).isoformat()

    print(
        f"Created vocab 'testword'. \nNext review: {next_review}\nExpected: {expected_next_review}"
    )

    assert next_review == expected_next_review
    print("Verification successful: next_review is set to tomorrow!")


if __name__ == "__main__":
    try:
        test_vocab_creation_date()
    except Exception as e:
        print(f"Test failed: {e}")
        sys.exit(1)
