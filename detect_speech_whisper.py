import os
import math
import base64
from typing import Tuple

import numpy as np
import soundfile as sf
import sherpa_onnx
import onnxruntime as ort
import kaldi_native_fbank as knf
import torch


# ==== Whisper ASR Model (raw ONNX) ====
class WhisperOnnxModel:
    def __init__(self, encoder_path: str, decoder_path: str):
        session_opts = ort.SessionOptions()
        session_opts.inter_op_num_threads = 1
        session_opts.intra_op_num_threads = 4
        self.session_opts = session_opts

        # Encoder
        self.encoder = ort.InferenceSession(
            encoder_path,
            sess_options=self.session_opts,
            providers=["CPUExecutionProvider"],
        )

        # Read metadata from encoder
        meta = self.encoder.get_modelmeta().custom_metadata_map
        self.n_text_layer = int(meta["n_text_layer"])
        self.n_text_ctx = int(meta["n_text_ctx"])
        self.n_text_state = int(meta["n_text_state"])
        self.n_mels = int(meta["n_mels"])
        self.sot = int(meta["sot"])
        self.eot = int(meta["eot"])
        self.translate = int(meta["translate"])
        self.transcribe = int(meta["transcribe"])
        self.no_timestamps = int(meta["no_timestamps"])
        self.no_speech = int(meta["no_speech"])
        self.blank = int(meta["blank_id"])

        self.sot_sequence = list(map(int, meta["sot_sequence"].split(",")))
        self.sot_sequence.append(self.no_timestamps)

        self.is_multilingual = int(meta["is_multilingual"]) == 1

        if self.is_multilingual:
            self.all_language_tokens = list(
                map(int, meta["all_language_tokens"].split(","))
            )
            self.all_language_codes = meta["all_language_codes"].split(",")
            self.lang2id = dict(zip(self.all_language_codes, self.all_language_tokens))
            self.id2lang = dict(zip(self.all_language_tokens, self.all_language_codes))

        # Decoder
        self.decoder = ort.InferenceSession(
            decoder_path,
            sess_options=self.session_opts,
            providers=["CPUExecutionProvider"],
        )

        print(
            f"Whisper model: n_mels={self.n_mels}, n_text_layer={self.n_text_layer}, "
            f"n_text_ctx={self.n_text_ctx}, n_text_state={self.n_text_state}"
        )
        print(f"  sot={self.sot}, eot={self.eot}, blank={self.blank}")
        print(f"  is_multilingual={self.is_multilingual}")

    def run_encoder(self, mel: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        n_layer_cross_k, n_layer_cross_v = self.encoder.run(
            [
                self.encoder.get_outputs()[0].name,
                self.encoder.get_outputs()[1].name,
            ],
            {self.encoder.get_inputs()[0].name: mel.numpy()},
        )
        return torch.from_numpy(n_layer_cross_k), torch.from_numpy(n_layer_cross_v)

    def run_decoder(
        self,
        tokens: torch.Tensor,
        n_layer_self_k_cache: torch.Tensor,
        n_layer_self_v_cache: torch.Tensor,
        n_layer_cross_k: torch.Tensor,
        n_layer_cross_v: torch.Tensor,
        offset: torch.Tensor,
    ):
        logits, out_k_cache, out_v_cache, *rest = self.decoder.run(
            [
                self.decoder.get_outputs()[0].name,
                self.decoder.get_outputs()[1].name,
                self.decoder.get_outputs()[2].name,
            ],
            {
                self.decoder.get_inputs()[0].name: tokens.numpy(),
                self.decoder.get_inputs()[1].name: n_layer_self_k_cache.numpy(),
                self.decoder.get_inputs()[2].name: n_layer_self_v_cache.numpy(),
                self.decoder.get_inputs()[3].name: n_layer_cross_k.numpy(),
                self.decoder.get_inputs()[4].name: n_layer_cross_v.numpy(),
                self.decoder.get_inputs()[5].name: offset.numpy(),
            },
        )
        return (
            torch.from_numpy(logits),
            torch.from_numpy(out_k_cache),
            torch.from_numpy(out_v_cache),
        )

    def get_self_cache(self) -> Tuple[torch.Tensor, torch.Tensor]:
        batch_size = 1
        k_cache = torch.zeros(
            self.n_text_layer, batch_size, self.n_text_ctx, self.n_text_state
        )
        v_cache = torch.zeros(
            self.n_text_layer, batch_size, self.n_text_ctx, self.n_text_state
        )
        return k_cache, v_cache

    def suppress_tokens(self, logits, is_initial: bool) -> None:
        if is_initial:
            logits[self.eot] = float("-inf")
            logits[self.blank] = float("-inf")

        logits[self.no_timestamps] = float("-inf")
        logits[self.sot] = float("-inf")
        logits[self.no_speech] = float("-inf")
        logits[self.translate] = float("-inf")


def load_tokens(filename):
    """Load tokens (base64-encoded format: base64_token id)."""
    tokens = dict()
    with open(filename, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                t, i = parts[0], int(parts[1])
                tokens[i] = t
    return tokens


def compute_whisper_features_from_samples(
    samples: np.ndarray,
    sample_rate: int,
    n_mels: int = 80,
) -> torch.Tensor:
    """Compute Whisper mel features from audio samples (numpy array)."""
    if sample_rate != 16000:
        import librosa

        samples = librosa.resample(samples, orig_sr=sample_rate, target_sr=16000)
        sample_rate = 16000

    opts = knf.WhisperFeatureOptions()
    opts.dim = n_mels
    online_whisper_fbank = knf.OnlineWhisperFbank(opts)
    online_whisper_fbank.accept_waveform(16000, samples.tolist())
    online_whisper_fbank.input_finished()

    features = []
    for i in range(online_whisper_fbank.num_frames_ready):
        f = online_whisper_fbank.get_frame(i)
        f = torch.from_numpy(f)
        features.append(f)

    features = torch.stack(features)

    log_spec = torch.clamp(features, min=1e-10).log10()
    log_spec = torch.maximum(log_spec, log_spec.max() - 8.0)
    mel = (log_spec + 4.0) / 4.0
    # mel: (T, n_mels)

    # Pad 1500 frames at end to detect eot
    mel = torch.nn.functional.pad(mel, (0, 0, 0, 1500), "constant", 0)

    target = 3000
    if mel.shape[0] > target:
        mel = mel[: target - 50]
        mel = torch.nn.functional.pad(mel, (0, 0, 0, 50), "constant", 0)

    mel = mel.t().unsqueeze(0)  # (1, n_mels, T)
    return mel


def transcribe_whisper(
    model: WhisperOnnxModel, audio_segment: np.ndarray, token_table: dict
) -> str:
    """Chạy ASR Whisper trên một đoạn audio (numpy array, float32, 16kHz)."""
    mel = compute_whisper_features_from_samples(
        audio_segment, 16000, n_mels=model.n_mels
    )

    n_layer_cross_k, n_layer_cross_v = model.run_encoder(mel)

    n_layer_self_k_cache, n_layer_self_v_cache = model.get_self_cache()

    # Initial decode with sot_sequence
    sot_sequence = list(model.sot_sequence)
    tokens = torch.tensor([sot_sequence], dtype=torch.int64)
    offset = torch.zeros(1, dtype=torch.int64)

    logits, n_layer_self_k_cache, n_layer_self_v_cache = model.run_decoder(
        tokens=tokens,
        n_layer_self_k_cache=n_layer_self_k_cache,
        n_layer_self_v_cache=n_layer_self_v_cache,
        n_layer_cross_k=n_layer_cross_k,
        n_layer_cross_v=n_layer_cross_v,
        offset=offset,
    )
    offset += len(sot_sequence)

    logits = logits[0, -1]
    model.suppress_tokens(logits, is_initial=True)
    max_token_id = logits.argmax(dim=-1)

    results = []
    for _ in range(model.n_text_ctx):
        if max_token_id == model.eot:
            break
        results.append(max_token_id.item())

        tokens = torch.tensor([[results[-1]]])
        logits, n_layer_self_k_cache, n_layer_self_v_cache = model.run_decoder(
            tokens=tokens,
            n_layer_self_k_cache=n_layer_self_k_cache,
            n_layer_self_v_cache=n_layer_self_v_cache,
            n_layer_cross_k=n_layer_cross_k,
            n_layer_cross_v=n_layer_cross_v,
            offset=offset,
        )
        offset += 1
        logits = logits[0, -1]
        model.suppress_tokens(logits, is_initial=False)
        max_token_id = logits.argmax(dim=-1)

    # Decode tokens using base64
    s = b""
    for i in results:
        if i in token_table:
            try:
                s += base64.b64decode(token_table[i])
            except Exception:
                pass
    return s.decode("utf-8", errors="replace").strip()


def format_time(seconds):
    """Chuyển giây thành mm:ss.ms"""
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m:02d}:{s:05.2f}"


# ==== 1. Config VAD model ====
model_path = "vad-model\\silero_vad.onnx"
sample_rate = 16000
block_size = 512

vad_config = sherpa_onnx.VadModelConfig(
    silero_vad=sherpa_onnx.SileroVadModelConfig(
        model=model_path,
        window_size=block_size,
        threshold=0.3,
        min_speech_duration=0,
        min_silence_duration=0,
    ),
    sample_rate=sample_rate,
)

vad = sherpa_onnx.VoiceActivityDetector(vad_config)

# ==== 2. Load Whisper ASR model (raw ONNX) ====
asr_dir = "sherpa-onnx-whisper-distil-small.en"
print("Loading Whisper ASR model (raw ONNX)...")

asr_model = WhisperOnnxModel(
    encoder_path=os.path.join(asr_dir, "distil-small.en-encoder.onnx"),
    decoder_path=os.path.join(asr_dir, "distil-small.en-decoder.onnx"),
)

# Load tokens
token_table = load_tokens(os.path.join(asr_dir, "distil-small.en-tokens.txt"))
print(f"Loaded {len(token_table)} tokens.")
print("Whisper ASR model loaded.")

# ==== 3. Load audio ====
audio_path = "English Listening & Shadowing Practice_ Real Daily Conversations! English Podcast EP 119.mp3"
print(f"Loading audio: {audio_path}")
waveform, sr = sf.read(audio_path)

# Nếu stereo, convert về mono
if waveform.ndim > 1:
    waveform = np.mean(waveform, axis=1)

# Resample nếu cần
if sr != sample_rate:
    import librosa

    waveform = librosa.resample(waveform, orig_sr=sr, target_sr=sample_rate)

waveform = waveform.astype(np.float32)

# ==== 4. Tạo output folder ====
output_dir = "speech_segments"
os.makedirs(output_dir, exist_ok=True)

# ==== 5. Inference VAD + ASR ====
print("Running VAD + ASR...")
print("=" * 60)

DEBUG_VAD = False  # Set to True to print is_speech state changes


def dynamic_threshold(t):
    MAX = 1.5
    MIN = 0.01
    k = 2  # độ gắt
    t0 = 2  # bắt đầu giảm mạnh sau 2.5s
    return MIN + (MAX - MIN) / (1 + math.exp(k * (t - t0)))


current_speech_start = None
speech_start_idx = None
silence_start_idx = None  # index bắt đầu silence hiện tại
time_per_sample = 1.0 / sample_rate
segment_count = 0


def process_segment(start_time, start_idx, end_idx):
    """Chạy ASR, in kết quả, save audio."""
    global segment_count
    segment_count += 1

    # Bù trừ độ trễ của VAD: lùi lại 2 blocks (2 * 512 samples)
    pre_buffer_samples = 2 * block_size
    actual_start_idx = max(0, start_idx - pre_buffer_samples)
    actual_start_time = actual_start_idx * time_per_sample

    end_time = end_idx * time_per_sample
    speech_audio = waveform[actual_start_idx:end_idx]

    text = transcribe_whisper(asr_model, speech_audio, token_table)

    start_str = format_time(actual_start_time)
    end_str = format_time(end_time)
    print(f"[{start_str} -> {end_str}] {text}")

    filename = f"{start_str} - {end_str}.wav".replace(":", "_")
    filepath = os.path.join(output_dir, filename)
    sf.write(filepath, speech_audio, sample_rate)


prev_is_speech = False

for i, sample in enumerate(waveform):
    vad.accept_waveform(np.array([sample], dtype=np.float32))
    is_speech = vad.is_speech_detected()

    if DEBUG_VAD and i % 1600 == 0:  # In log mỗi 0.1 giây
        print(
            f"[DEBUG VAD] Time {format_time(i * time_per_sample)} - is_speech: {is_speech}"
        )

    if is_speech and current_speech_start is None:
        # Speech mới bắt đầu
        current_speech_start = i * time_per_sample
        speech_start_idx = i
        silence_start_idx = None

    elif is_speech and current_speech_start is not None:
        # Đang speech, reset silence counter
        silence_start_idx = None

    elif not is_speech and current_speech_start is not None:
        # Đang trong segment speech mà gặp silence
        if silence_start_idx is None:
            # Silence mới bắt đầu
            silence_start_idx = i

        # Tính duration của segment hiện tại (từ lúc bắt đầu speech)
        segment_duration = (i - speech_start_idx) * time_per_sample

        # Tính silence threshold theo sigmoid
        silence_threshold = dynamic_threshold(segment_duration)

        # Tính silence duration hiện tại
        current_silence = (i - silence_start_idx) * time_per_sample

        if current_silence >= silence_threshold:
            # Silence đủ dài -> cắt segment (end tại chỗ silence bắt đầu)
            process_segment(current_speech_start, speech_start_idx, silence_start_idx)
            current_speech_start = None
            speech_start_idx = None
            silence_start_idx = None

# Nếu audio kết thúc mà vẫn đang speech
if current_speech_start is not None:
    end_idx = len(waveform)
    process_segment(current_speech_start, speech_start_idx, end_idx)

print("=" * 60)
print(f"Done! {segment_count} segments saved to '{output_dir}/'")
