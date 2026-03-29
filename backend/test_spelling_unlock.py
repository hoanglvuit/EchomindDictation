import os
import sys

# Thêm đường dẫn backend vào sys.path để import được db
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.connection import init_db, get_db
from db.vocab import save_vocab, get_due_vocab, update_vocab_sm2

def test_spelling_unlock():
    print("Mồi database...")
    init_db()
    
    # 1. Tạo từ mới
    word = "test_unlock_word"
    save_vocab(word, "test", [{"definition": "test def"}])
    
    with get_db() as conn:
        row = conn.execute("SELECT * FROM vocab WHERE word = ?", (word,)).fetchone()
        vocab_id = row['id']
        print(f"Đã tạo từ: {word}, ID: {vocab_id}, Rep: {row['repetition']}, Unlocked: {row['spelling_unlocked']}")
    
    # 2. Kiểm tra type ban đầu (phải là MCQ nếu có đủ 4 từ trở lên trong DB)
    # Giả sử có đủ từ rồi
    due = get_due_vocab("3000-01-01")
    item = next(x for x in due if x['word'] == word)
    print(f"Quiz type ban đầu: {item['quiz_type']}")
    
    # 3. Nâng rep lên 2 để unlock spelling
    print("Nâng rep lên 2...")
    update_vocab_sm2(vocab_id, 5) # rep 1
    update_vocab_sm2(vocab_id, 5) # rep 2
    
    with get_db() as conn:
        row = conn.execute("SELECT * FROM vocab WHERE id = ?", (vocab_id,)).fetchone()
        print(f"Sau khi học: Rep: {row['repetition']}, Unlocked: {row['spelling_unlocked']}")
        assert row['spelling_unlocked'] == 1
    
    # 4. Kiểm tra quiz type (phải là spelling)
    due = get_due_vocab("3000-01-01")
    item = next(x for x in due if x['word'] == word)
    print(f"Quiz type sau khi unlock: {item['quiz_type']}")
    assert item['quiz_type'] == "spelling"
    
    # 5. Fail từ này (quality = 0)
    print("Thử làm sai (Quality 0)...")
    update_vocab_sm2(vocab_id, 0)
    
    with get_db() as conn:
        row = conn.execute("SELECT * FROM vocab WHERE id = ?", (vocab_id,)).fetchone()
        print(f"Sau khi làm sai: Rep: {row['repetition']}, Unlocked: {row['spelling_unlocked']}")
        assert row['repetition'] == 0
        assert row['spelling_unlocked'] == 1 # Quan trọng nhất là cái này vẫn là 1
        
    # 6. Kiểm tra lại quiz type (vẫn phải là spelling dù rep=0)
    due = get_due_vocab("3000-01-01")
    item = next(x for x in due if x['word'] == word)
    print(f"Quiz type sau khi làm sai: {item['quiz_type']}")
    assert item['quiz_type'] == "spelling"
    
    print("TEST PASSED!")

if __name__ == "__main__":
    test_spelling_unlock()
