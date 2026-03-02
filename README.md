# EchoMind: Advanced English Listening Platform with SM-2 Spaced Repetition & AI Transcription

Một ứng dụng nền tảng Web giúp luyện nghe chép chính tả tiếng Anh hiệu quả, tích hợp công nghệ AI nhận diện giọng nói và hệ thống ôn tập từ vựng thông minh (Spaced Repetion).

---

## 🏛 Kiến trúc hệ thống

Dự án được xây dựng với mô hình Client-Server tách biệt:

### Backend (Python/FastAPI)
- **Framework**: FastAPI xử lý các yêu cầu API hiệu năng cao.
- **Xử lý âm thanh**: 
    - **VAD (Voice Activity Detection)**: Sử dụng mô hình `Silero VAD` (via `sherpa-onnx`) để tự động tách các đoạn hội thảo dựa trên giọng nói.
    - **ASR (Automatic Speech Recognition)**: Sử dụng mô hình `Whisper ONNX (distil-small.en)` để chuyển đổi âm thanh sang văn bản chính xác.
- **Database**: SQLite lưu trữ dữ liệu bài học, các phân đoạn âm thanh, tiến trình học và sổ tay từ vựng.
- **Thuật toán SM-2**: Triển khai logic lặp lại ngắt quãng để tối ưu hóa việc ghi nhớ từ vựng.

### Frontend (React/Vite)
- **Framework**: React với Vite cho tốc độ phát triển và build cực nhanh.
- **Giao diện**: Thiết kế theo phong cách **Glassmorphism** hiện đại, responsive.
- **Quản lý trạng thái**: Sử dụng React Hooks (useState, useEffect, useCallback) để xử lý logic luyện tập và ôn tập.

---

## 🌟 Tính năng cốt lõi

### 1. Phân đoạn & Nhận diện tự động
Khi bạn upload một file âm thanh, hệ thống sẽ:
- **Tự động cắt đoạn (VAD)**: Sử dụng `Silero VAD` để chia nhỏ file.
- **Dynamic Silence Threshold**: Áp dụng kỹ thuật ngưỡng im lặng động (Dynamic Threshold). Các đoạn thoại dài sẽ được áp dụng ngưỡng khắt khe hơn để tránh việc cắt giữa chừng khi người nói tạm nghỉ ngắn, trong khi các đoạn ngắn được xử lý linh hoạt hơn.
- **Nhận diện AI**: Sử dụng AI để tạo ra "Transcript" cho từng đoạn.
- **Lưu trữ session**: Tự động lưu tiến trình để bạn có thể học tiếp bất cứ lúc nào (Progress Tracking).

### 2. Chế độ luyện tập Dictation
- Nghe từng đoạn âm thanh và gõ lại nội dung.
- Kiểm tra tính chính xác ngay lập tức.
- Phím tắt thông minh: `Ctrl` để nghe lại, `Enter` để kiểm tra/chuyển đoạn.
- Hỗ trợ "Hint" (gợi ý) từ tiếp theo nếu bạn gặp khó khăn.

### 3. Sổ tay từ vựng & Ôn tập lũy tiến (SM-2)
- **Lưu từ**: Click trực tiếp vào từ vựng trong bài tập để lưu kèm phiên âm, định nghĩa và ví dụ.
- **Hệ thống ôn tập SM-2 đặc biệt**:
    - **Giai đoạn Làm quen (Repetition < 2)**: Sử dụng câu hỏi **Trắc nghiệm (MCQ)**.
    - **Giai đoạn Ghi nhớ (Repetition >= 2)**: Chuyển sang câu hỏi **Tự luận (Spelling)** để rèn luyện Active Recall.
- **Thang điểm**: Linh hoạt dựa trên độ khó của hình thức kiểm tra (MCQ 1-2 điểm, Spelling 3-5 điểm).

---

## 🛠 Cấu trúc thư mục

```text
english-listening/
├── backend/
│   ├── app.py              # Entry point của FastAPI server & các API endpoints
│   ├── database.py         # Lớp xử lý SQLite và thuật toán SM-2
│   ├── asr_engine.py       # Engine xử lý VAD và Whisper ASR
│   ├── model/              # Lưu trữ các file .onnx của VAD và Whisper
│   └── sessions/           # Lưu trữ các tệp âm thanh đã phân đoạn
├── frontend/
│   ├── src/
│   │   ├── components/     # Các UI Components (Exercise, Vocab,...)
│   │   ├── api.js          # Các hàm gọi API backend
│   │   └── App.jsx         # Component gốc của ứng dụng
│   └── index.html
└── README.md
```

---

## � Hướng dẫn khởi chạy

### Backend
1. Yêu cầu Python 3.8+.
2. Di chuyển vào thư mục `backend`.
3. Cài đặt phụ thuộc: `pip install -r requirements.txt`.
4. Khởi chạy server: `python app.py`.
   - *Mặc định chạy ở cổng: 8001*

### Frontend
1. Yêu cầu Node.js và npm.
2. Di chuyển vào thư mục `frontend`.
3. Cài đặt phụ thuộc: `npm install`.
4. Chạy chế độ phát triển: `npm run dev`.
   - *Truy cập ứng dụng qua cổng: 5173*

---

## � Cấu trúc dữ liệu (Database Schema)

- **`lesson`**: Thông tin session học, tệp gốc và tiến độ (`progress`).
- **`segment`**: Chi tiết từng đoạn âm thanh (thời gian bắt đầu/kết thúc, transcript).
- **`vocab`**: Sổ tay từ vựng với các chỉ số SM-2 (`easiness_factor`, `repetition`, `next_review`).
- **`vocab_definition`**: Lưu trữ đa định nghĩa và ví dụ thực tế cho mỗi từ.
