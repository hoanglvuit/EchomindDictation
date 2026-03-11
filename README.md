# EchoMind: Advanced English Listening Platform with SM-2 Spaced Repetition & AI Transcription

Một ứng dụng nền tảng Web giúp luyện nghe chép chính tả tiếng Anh hiệu quả, tích hợp công nghệ AI nhận diện giọng nói và hệ thống ôn tập từ vựng thông minh (Spaced Repetion).

---

## 🏛 Kiến trúc hệ thống

Dự án được xây dựng với mô hình Client-Server tách biệt:

### Backend (Python/FastAPI)
- **Framework**: FastAPI xử lý các yêu cầu API hiệu năng cao.
- **Xử lý âm thanh (WhisperX Pipeline)**: 
    - **VAD (Voice Activity Detection)**: Sử dụng `Pyannote VAD` (tích hợp bên trong WhisperX) để tự động phát hiện vùng có giọng nói.
    - **ASR (Automatic Speech Recognition)**: Sử dụng `WhisperX` (model `medium.en`) để chuyển đổi âm thanh sang văn bản với word-level timestamps chính xác.
    - **Segmentation**: Tách audio theo ranh giới câu/cụm từ tự nhiên dựa trên output segments của WhisperX.
- **Database**: SQLite lưu trữ dữ liệu bài học, các phân đoạn âm thanh, tiến trình học và sổ tay từ vựng.
- **Thuật toán SM-2**: Triển khai logic lặp lại ngắt quãng để tối ưu hóa việc ghi nhớ từ vựng.

### Frontend (React/Vite)
- **Framework**: React với Vite cho tốc độ phát triển và build cực nhanh.
- **Giao diện**: Thiết kế theo phong cách **Glassmorphism** hiện đại, responsive.
- **Quản lý trạng thái**: Sử dụng React Hooks (useState, useEffect, useCallback) để xử lý logic luyện tập và ôn tập.

---

## 🌟 Tính năng cốt lõi

### 1. Phân đoạn & Nhận diện tự động (WhisperX)
Khi bạn upload một file âm thanh, hệ thống sẽ:
- **VAD tự động (Pyannote)**: Lọc các vùng có giọng nói, loại bỏ silence.
- **Transcription (WhisperX)**: Nhận diện giọng nói với word-level alignment chính xác.
- **Tách segment theo câu**: Mỗi segment là một câu/cụm từ tự nhiên (tối đa `CHUNK_SIZE` giây), giúp dictation hiệu quả hơn.
- **Lưu trữ session**: Tự động lưu tiến trình để bạn có thể học tiếp bất cứ lúc nào (Progress Tracking).

### 2. Chế độ luyện tập Dictation
- Nghe từng đoạn âm thanh và gõ lại nội dung.
- Kiểm tra tính chính xác ngay lập tức.
- Phím tắt thông minh: `Ctrl` để nghe lại, `Enter` để kiểm tra/chuyển đoạn.
- Hỗ trợ "Hint" (gợi ý) từ tiếp theo nếu bạn gặp khó khăn.

### 3. Sổ tay từ vựng & Ôn tập lũy tiến (SM-2)
- **Quick Save (v5)**: Click vào từ trong bài tập để lưu nhanh — không cần điền thông tin ngay, hoàn thành sau trong Vocabulary.
- **Vocabulary Dashboard (MỚI v6)**: Giao diện quản lý từ vựng thông minh, tự động phân loại thành 3 nhóm:
    - **Needs Details**: Từ mới lưu nhanh, chưa có định nghĩa (📝).
    - **Due for Practice**: Từ đã đến hạn ôn tập (🧠).
    - **Future Review**: Từ đã học và đang chờ đến lịch ôn tiếp theo (📅).
- **Tối ưu hiệu năng (v6)**: 
    - **Pagination (View More)**: Chỉ hiển thị 20 từ mỗi trang, giúp giao diện mượt mà ngay cả khi có hàng nghìn từ.
    - **Fisher-Yates Shuffle**: Xáo trộn ngẫu nhiên tuyệt đối thứ tự từ vựng mỗi khi bắt đầu ôn tập, giúp tăng hiệu quả ghi nhớ.
- **Full Edit**: Hoặc chọn "Details" để mở form điền đầy đủ phiên âm, nghĩa, ví dụ.
- **Tích hợp Oxford Dictionary**: 
    - Tự động lấy **phiên âm (IPA)** và **âm thanh (US MP3)** khi nhập link từ Oxford.
    - Hỗ trợ điền tự động (Auto-fetch) ngay khi dán link.
- **Cấu trúc từ vựng tối ưu cho việc học**:
    - **Core Idea (General Meaning)**: Một định nghĩa cốt lõi, ngắn gọn bằng tiếng Anh giúp nắm bắt ý tưởng chính.
    - **Usage Categories**: Chia nhỏ các nét nghĩa theo nhóm thông dụng nhất (1-3 nhóm chính).
    - **Usage Patterns**: Làm nổi bật các cấu trúc sử dụng phổ biến (Ví dụ: `get + adjective`).
    - **Ví dụ thực tế**: Mỗi nét nghĩa đi kèm với một câu ví dụ tự nhiên.
- **Hệ thống ôn tập SM-2 đặc biệt**:
    - Từ chưa hoàn thành (chỉ quick-save) sẽ **không vào SM-2** cho đến khi có ít nhất 1 definition.
    - **Giai đoạn Làm quen (Repetition < 2)**: Sử dụng câu hỏi **Trắc nghiệm (MCQ)**.
    - **Giai đoạn Ghi nhớ (Repetition >= 2)**: Chuyển sang câu hỏi **Tự luận (Spelling)** để rèn luyện Active Recall.
- **Phát âm thanh thông minh**: 
    - Nút 🔊 xuất hiện trong danh sách từ vựng.
    - Tự động hiển thị nút phát sau khi trả lời đúng trong lúc ôn tập để củng cố kỹ năng nghe.
- **Thang điểm**: Linh hoạt dựa trên độ khó của hình thức kiểm tra (MCQ 1-2 điểm, Spelling 3-5 điểm).

---

## 🛠 Cấu trúc thư mục

```text
english-listening/
├── backend/
│   ├── app.py              # Entry point của FastAPI server & các API endpoints
│   ├── database.py         # Lớp xử lý SQLite và thuật toán SM-2
│   ├── asr_engine.py       # Engine xử lý WhisperX transcription & segmentation
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

## 🚀 Hướng dẫn khởi chạy

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

## 📊 Cấu trúc dữ liệu (Database Schema)

- **`lesson`**: Thông tin session học, tệp gốc và tiến độ (`progress`).
- **`segment`**: Chi tiết từng đoạn âm thanh (thời gian bắt đầu/kết thúc, transcript).
- **`vocab`**: Sổ tay từ vựng với các chỉ số SM-2 (`easiness_factor`, `repetition`, `next_review`), link âm thanh (`audio_url`) và ý nghĩa cốt lõi (`general_meaning`).
- **`vocab_definition`**: Lưu trữ đa định nghĩa, ví dụ thực tế và các mẫu câu thông dụng (`patterns`) cho mỗi từ.

---

## 📋 Changelog

### Version 6 — Vocabulary Dashboard & Performance (MỚI)

#### Thay đổi chính: Vocab Management
| Tính năng | Mô tả |
|---|---|
| **Dashboard Phân loại** | Giao diện thẻ (Card) giúp quản lý từ vựng theo trạng thái: Cần bổ sung, Đến hạn ôn, Chờ ôn tập. |
| **Pagination (View More)** | Tối ưu hóa việc hiển thị 20 từ mỗi lượt, giúp xử lý hàng nghìn từ vựng mà không gây lag. |
| **Fisher-Yates Shuffle** | Xáo trộn ngẫu nhiên tuyệt đối các từ vựng trong bài tập Practice, tránh học vẹt theo thứ tự. |
| **Navigation** | Bổ sung hệ thống chuyển đổi mượt mà giữa các mục phân loại và quay lại dashboard. |

### Version 5 — WhisperX Migration & Quick-Save Vocab

#### Thay đổi chính: ASR Pipeline

| | v4 (Cũ) | v5 (Mới) |
|---|---|---|
| **VAD** | Silero VAD (sherpa-onnx) + Dynamic Silence Threshold tùy chỉnh | Pyannote VAD (tích hợp trong WhisperX) |
| **ASR** | Whisper ONNX (`distil-small.en`) | WhisperX (`medium.en`) với word-level alignment |
| **Segmentation** | Tách theo silence ≥ threshold (dynamic) | Tách theo câu/cụm từ tự nhiên từ WhisperX segments |
| **Config** | `vad_max, vad_min, vad_k, vad_t0, threshold` | `VAD_ONSET, VAD_OFFSET, CHUNK_SIZE` |

#### Tại sao chuyển sang WhisperX?

1. **Segment theo câu**: WhisperX tự động tách theo ranh giới câu/cụm từ tự nhiên, thay vì tách thô theo silence. Điều này cho ra các segment có ý nghĩa hoàn chỉnh → dictation hiệu quả hơn.
2. **Word-level timestamps**: WhisperX cung cấp timestamp chính xác đến từng từ thông qua forced alignment, giúp cắt audio chính xác hơn.
3. **Đơn giản hóa**: Loại bỏ 5 tham số dynamic threshold phức tạp, thay bằng 3 config đơn giản (`VAD_ONSET`, `VAD_OFFSET`, `CHUNK_SIZE`).
4. **Model lớn hơn, chính xác hơn**: Dùng `medium.en` thay vì `distil-small.en` → transcript chính xác hơn đáng kể.

#### Luồng cũ (v4)
```
Audio → Silero VAD (sherpa-onnx) → Dynamic Silence Threshold → Tách chunks → Whisper ONNX transcribe từng chunk → Segments
```
**Nhược điểm**: Tách theo silence nên segment có thể bị cắt giữa câu, hoặc quá ngắn/quá dài. 5 tham số dynamic threshold khó config.

#### Luồng mới (v5)
```
Audio → WhisperX (Pyannote VAD + Whisper transcribe + Forced Alignment) → Segments (tách theo câu tự nhiên) → Cắt audio theo start/end
```
**Ưu điểm**: Mỗi segment là một câu hoàn chỉnh. Config đơn giản. Transcript chính xác hơn.

#### Quick-Save Vocabulary (Mới)
- Click vào từ trong bài dictation → popup hiện **"⚡ Quick Save"** và **"📝 Details"**.
- Quick Save lưu từ ngay lập tức mà không cần mở form → không ngắt quãng quá trình chép.
- Từ quick-save chưa có definition sẽ **không vào SM-2** — hoàn thành sau trong mục Vocabulary.

#### Dependencies thay đổi
- **Thêm**: `whisperx`, `librosa`
- **Bỏ**: `onnxruntime`, `kaldi-native-fbank`
