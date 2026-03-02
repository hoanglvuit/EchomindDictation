import sys
import os

# Mocking database path for testing
os.environ["DB_PATH"] = ":memory:"

# Import from the project
sys.path.append(r"f:\Máy tính\english-listening\backend")
from database import sm2_update


def test_sm2():
    print("Testing SM-2 Update Logic...")

    # Case 1: MCQ Correct 1st try (q=2, rep=0)
    ef, rep, interval = sm2_update(2, 2.5, 0, 0)
    print(
        f"MCQ q=2, rep=0 -> new_rep: {rep} (Expected 1), new_interval: {interval} (Expected 1)"
    )
    assert rep == 1

    # Case 2: MCQ Correct 2nd try (q=1, rep=1)
    ef, rep, interval = sm2_update(1, ef, 1, 1)
    print(
        f"MCQ q=1, rep=1 -> new_rep: {rep} (Expected 2), new_interval: {interval} (Expected 6)"
    )
    assert rep == 2

    # Case 3: Spelling Correct 1st try (q=5, rep=2)
    ef, rep, interval = sm2_update(5, ef, 2, 6)
    print(
        f"Spelling q=5, rep=2 -> new_rep: {rep} (Expected 3), new_interval: {interval} (>6)"
    )
    assert rep == 3
    assert interval > 6

    # Case 4: Failed (q=0)
    ef, rep, interval = sm2_update(0, ef, 3, 10)
    print(
        f"Failed q=0 -> new_rep: {rep} (Expected 0), new_interval: {interval} (Expected 1)"
    )
    assert rep == 0
    assert interval == 1

    print("\nAll tests passed!")


if __name__ == "__main__":
    test_sm2()
