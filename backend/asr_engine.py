"""
ASR Engine — WhisperX transcription + segmentation.
WhisperX uses pyannote VAD internally to filter speech,
then produces segments with timestamps for splitting.
"""

import os
import gc

import soundfile as sf
import whisperx

# ============================================================
# Constants
# ============================================================
SAMPLE_RATE = 16000

# WhisperX config
WHISPERX_MODEL = "medium.en"  # "base.en", "small.en"
WHISPERX_DEVICE = "cpu"
WHISPERX_COMPUTE_TYPE = "float32"
WHISPERX_BATCH_SIZE = 2

# VAD config (pyannote inside WhisperX)
VAD_ONSET = 0.5  # threshold to start speech detection
VAD_OFFSET = 0.363  # threshold to end speech detection
CHUNK_SIZE = 15  # max seconds per segment
PAD_ONSET = 0.05  # pre-buffer in seconds (5 blocks × 512 samples / 16000)
PAD_OFFSET = 0.05  # post-buffer in seconds


def format_time(seconds):
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m:02d}:{s:05.2f}"


# ============================================================
# Main processing function
# ============================================================
def process_audio(file_path, session_dir):
    """
    Process audio with WhisperX:
    1. Transcribe + align (VAD is handled internally by pyannote)
    2. Split audio by WhisperX segment boundaries (start/end)
    3. Save each segment as .wav + return segment list

    Returns list of segment dicts compatible with add_segments().
    """
    # 1. WhisperX transcription
    print(f"  Loading WhisperX model ({WHISPERX_MODEL})...")
    vad_options = {
        "vad_onset": VAD_ONSET,
        "vad_offset": VAD_OFFSET,
        "chunk_size": CHUNK_SIZE,
    }
    model = whisperx.load_model(
        WHISPERX_MODEL,
        WHISPERX_DEVICE,
        compute_type=WHISPERX_COMPUTE_TYPE,
        vad_options=vad_options,
    )

    audio = whisperx.load_audio(file_path)
    print("  Transcribing...")
    result = model.transcribe(
        audio,
        batch_size=WHISPERX_BATCH_SIZE,
        chunk_size=CHUNK_SIZE,
        print_progress=True,
    )

    # Free transcription model before loading alignment model
    del model
    gc.collect()

    # 3. Alignment for word-level timestamps
    print("  Aligning (word-level timestamps)...")
    model_a, metadata = whisperx.load_align_model(
        language_code="en", device=WHISPERX_DEVICE
    )
    result = whisperx.align(
        result["segments"],
        model_a,
        metadata,
        audio,
        WHISPERX_DEVICE,
        return_char_alignments=False,
    )

    del model_a
    gc.collect()

    wx_segments = result.get("segments", [])
    print(f"  WhisperX produced {len(wx_segments)} segments.")

    if not wx_segments:
        print("  No speech detected!")
        return []

    # 4. Split audio by WhisperX segment boundaries
    segments = []
    for idx, wx_seg in enumerate(wx_segments):
        start_sec = wx_seg.get("start", 0)
        end_sec = wx_seg.get("end", 0)
        text = wx_seg.get("text", "").strip()

        if not text:
            continue

        # Cut audio with pre/post buffer
        buf_start = max(0, start_sec - PAD_ONSET)
        buf_end = min(len(audio) / SAMPLE_RATE, end_sec + PAD_OFFSET)
        start_sample = int(buf_start * SAMPLE_RATE)
        end_sample = int(buf_end * SAMPLE_RATE)
        audio_chunk = audio[start_sample:end_sample]

        seg_idx = len(segments)
        wav_name = f"{seg_idx:04d}.wav"
        sf.write(os.path.join(session_dir, wav_name), audio_chunk, SAMPLE_RATE)

        segments.append(
            {
                "id": seg_idx,
                "filename": wav_name,
                "start_time": format_time(start_sec),
                "end_time": format_time(end_sec),
                "transcript": text,
            }
        )
        print(
            f"  Segment {seg_idx}: [{format_time(start_sec)} -> {format_time(end_sec)}] {text}"
        )

    return segments
