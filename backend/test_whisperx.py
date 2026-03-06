import whisperx
import torch
import json
import os


def run_test(audio_path):
    # 1. Cấu hình
    device = "cpu"
    batch_size = 4  # Thấp để không treo CPU
    compute_type = "float32"  # Chế độ mặc định cho CPU (không dùng int8)
    model_name = "medium.en"

    print(f"--- Đang tải model {model_name} ---")
    # 2. Load model transcription
    model = whisperx.load_model(model_name, device, compute_type=compute_type)

    print(f"--- Đang xử lý file: {audio_path} ---")
    # 3. Transcribe
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=batch_size)

    # Giải phóng bộ nhớ model transcription trước khi load model alignment
    # (Hữu ích khi chạy trên máy RAM yếu)
    import gc

    del model
    gc.collect()

    print(f"--- Đang Alignment (Word-level timestamps) ---")
    # 4. Load alignment model (mặc định cho tiếng Anh là WAV2VEC2_ASR_BASE_960H)
    model_a, metadata = whisperx.load_align_model(language_code="en", device=device)

    # 5. Thực hiện align
    result = whisperx.align(
        result["segments"],
        model_a,
        metadata,
        audio,
        device,
        return_char_alignments=False,
    )

    print(f"--- Kết quả ---")
    # In ra 5 từ đầu tiên để kiểm tra
    words = []
    for segment in result["segments"]:
        for word in segment.get("words", []):
            words.append(word)

    for w in words[:10]:  # In 10 từ đầu tiên
        start = w.get("start", "N/A")
        end = w.get("end", "N/A")
        text = w.get("word", "[UNK]")
        print(f"[{start:>6}s -> {end:>6}s]: {text}")

    # 6. Lưu kết quả ra JSON để bạn dễ xem
    output_file = "test_result.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=4, ensure_ascii=False)

    print(
        f"\n--- Hoàn tất! Kết quả chi tiết đã được lưu tại: {os.path.abspath(output_file)} ---"
    )


if __name__ == "__main__":
    # Thay đổi đường dẫn này thành file audio thực tế của bạn để test
    # Ví dụ: r"F:\Máy tính\english-listening\backend\sample.mp3"
    AUDIO_PATH = (
        input("Nhập đường dẫn đến file audio (.mp3, .wav...): ").strip().strip('"')
    )

    if os.path.exists(AUDIO_PATH):
        run_test(AUDIO_PATH)
    else:
        print(f"Lỗi: Không tìm thấy file tại {AUDIO_PATH}")
