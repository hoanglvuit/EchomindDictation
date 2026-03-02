"""
ASR Engine — Whisper ASR model + VAD processing.
Loads/unloads models on demand to save RAM.
"""

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


# ============================================================
# Whisper ONNX Model
# ============================================================
class WhisperOnnxModel:
    def __init__(self, encoder_path: str, decoder_path: str):
        session_opts = ort.SessionOptions()
        session_opts.inter_op_num_threads = 1
        session_opts.intra_op_num_threads = 4
        self.session_opts = session_opts

        self.encoder = ort.InferenceSession(
            encoder_path,
            sess_options=self.session_opts,
            providers=["CPUExecutionProvider"],
        )

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

        self.decoder = ort.InferenceSession(
            decoder_path,
            sess_options=self.session_opts,
            providers=["CPUExecutionProvider"],
        )

        print(
            f"Whisper model: n_mels={self.n_mels}, n_text_layer={self.n_text_layer}, "
            f"n_text_ctx={self.n_text_ctx}, n_text_state={self.n_text_state}"
        )

    def run_encoder(self, mel: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        n_layer_cross_k, n_layer_cross_v = self.encoder.run(
            [self.encoder.get_outputs()[0].name, self.encoder.get_outputs()[1].name],
            {self.encoder.get_inputs()[0].name: mel.numpy()},
        )
        return torch.from_numpy(n_layer_cross_k), torch.from_numpy(n_layer_cross_v)

    def run_decoder(
        self,
        tokens,
        n_layer_self_k_cache,
        n_layer_self_v_cache,
        n_layer_cross_k,
        n_layer_cross_v,
        offset,
    ):
        logits, out_k_cache, out_v_cache, *rest = self.decoder.run(
            [self.decoder.get_outputs()[i].name for i in range(3)],
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
        k = torch.zeros(
            self.n_text_layer, batch_size, self.n_text_ctx, self.n_text_state
        )
        v = torch.zeros(
            self.n_text_layer, batch_size, self.n_text_ctx, self.n_text_state
        )
        return k, v

    def suppress_tokens(self, logits, is_initial: bool) -> None:
        if is_initial:
            logits[self.eot] = float("-inf")
            logits[self.blank] = float("-inf")
        logits[self.no_timestamps] = float("-inf")
        logits[self.sot] = float("-inf")
        logits[self.no_speech] = float("-inf")
        logits[self.translate] = float("-inf")


# ============================================================
# Helper functions
# ============================================================
def load_tokens(filename):
    tokens = dict()
    with open(filename, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                t, i = parts[0], int(parts[1])
                tokens[i] = t
    return tokens


def compute_whisper_features(samples, sample_rate=16000, n_mels=80):
    if sample_rate != 16000:
        import librosa

        samples = librosa.resample(samples, orig_sr=sample_rate, target_sr=16000)

    opts = knf.WhisperFeatureOptions()
    opts.dim = n_mels
    fbank = knf.OnlineWhisperFbank(opts)
    fbank.accept_waveform(16000, samples.tolist())
    fbank.input_finished()

    features = torch.stack(
        [torch.from_numpy(fbank.get_frame(i)) for i in range(fbank.num_frames_ready)]
    )
    log_spec = torch.clamp(features, min=1e-10).log10()
    log_spec = torch.maximum(log_spec, log_spec.max() - 8.0)
    mel = (log_spec + 4.0) / 4.0
    mel = torch.nn.functional.pad(mel, (0, 0, 0, 1500), "constant", 0)

    target = 3000
    if mel.shape[0] > target:
        mel = mel[: target - 50]
        mel = torch.nn.functional.pad(mel, (0, 0, 0, 50), "constant", 0)

    return mel.t().unsqueeze(0)


def transcribe_whisper(model, audio_segment, token_table):
    mel = compute_whisper_features(audio_segment, 16000, n_mels=model.n_mels)
    n_layer_cross_k, n_layer_cross_v = model.run_encoder(mel)
    n_layer_self_k_cache, n_layer_self_v_cache = model.get_self_cache()

    sot_sequence = list(model.sot_sequence)
    tokens = torch.tensor([sot_sequence], dtype=torch.int64)
    offset = torch.zeros(1, dtype=torch.int64)

    logits, n_layer_self_k_cache, n_layer_self_v_cache = model.run_decoder(
        tokens,
        n_layer_self_k_cache,
        n_layer_self_v_cache,
        n_layer_cross_k,
        n_layer_cross_v,
        offset,
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
            tokens,
            n_layer_self_k_cache,
            n_layer_self_v_cache,
            n_layer_cross_k,
            n_layer_cross_v,
            offset,
        )
        offset += 1
        logits = logits[0, -1]
        model.suppress_tokens(logits, is_initial=False)
        max_token_id = logits.argmax(dim=-1)

    s = b""
    for i in results:
        if i in token_table:
            try:
                s += base64.b64decode(token_table[i])
            except Exception:
                pass
    return s.decode("utf-8", errors="replace").strip()


def format_time(seconds):
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m:02d}:{s:05.2f}"


# ============================================================
# VAD Processing
# ============================================================
SAMPLE_RATE = 16000
BLOCK_SIZE = 512


def dynamic_threshold(t, vmax=1.0, vmin=0.01, vk=2.0, vt0=2.5):
    """
    Computes a dynamic silence threshold based on the duration of the current speech segment.
    Longer segments get a lower (stricter) threshold.
    """
    return vmin + (vmax - vmin) / (1 + math.exp(vk * (t - vt0)))


def process_audio(
    file_path,
    vad_model_path,
    asr_model,
    token_table,
    session_dir,
    vad_max=1.0,
    vad_min=0.01,
    vad_k=2.0,
    vad_t0=2.5,
    vad_threshold=0.25,
):
    """Process audio: VAD segmentation + Whisper ASR. Saves WAV segments to session_dir."""
    waveform, sr = sf.read(file_path)
    if waveform.ndim > 1:
        waveform = np.mean(waveform, axis=1)
    if sr != SAMPLE_RATE:
        import librosa

        waveform = librosa.resample(waveform, orig_sr=sr, target_sr=SAMPLE_RATE)
    waveform = waveform.astype(np.float32)

    vad_config = sherpa_onnx.VadModelConfig(
        silero_vad=sherpa_onnx.SileroVadModelConfig(
            model=vad_model_path,
            window_size=BLOCK_SIZE,
            threshold=vad_threshold,
            min_speech_duration=0,
            min_silence_duration=0,
        ),
        sample_rate=SAMPLE_RATE,
    )
    vad = sherpa_onnx.VoiceActivityDetector(vad_config)

    time_per_sample = 1.0 / SAMPLE_RATE
    segments = []
    current_speech_start = None
    speech_start_idx = None
    silence_start_idx = None

    def finalize_segment(start_idx, end_idx):
        pre_buffer = 4 * BLOCK_SIZE
        actual_start = max(0, start_idx - pre_buffer)
        start_time = actual_start * time_per_sample
        end_time = end_idx * time_per_sample
        audio = waveform[actual_start:end_idx]

        text = transcribe_whisper(asr_model, audio, token_table)

        seg_idx = len(segments)
        wav_name = f"{seg_idx:04d}.wav"
        sf.write(os.path.join(session_dir, wav_name), audio, SAMPLE_RATE)

        segments.append(
            {
                "id": seg_idx,
                "filename": wav_name,
                "start_time": format_time(start_time),
                "end_time": format_time(end_time),
                "transcript": text,
            }
        )
        print(
            f"  Segment {seg_idx}: [{format_time(start_time)} -> {format_time(end_time)}] {text}"
        )

    for i, sample in enumerate(waveform):
        vad.accept_waveform(np.array([sample], dtype=np.float32))
        is_speech = vad.is_speech_detected()

        if is_speech and current_speech_start is None:
            current_speech_start = i * time_per_sample
            speech_start_idx = i
            silence_start_idx = None
        elif is_speech and current_speech_start is not None:
            silence_start_idx = None
        elif not is_speech and current_speech_start is not None:
            if silence_start_idx is None:
                silence_start_idx = i
            segment_duration = (i - speech_start_idx) * time_per_sample
            silence_threshold = dynamic_threshold(
                segment_duration, vad_max, vad_min, vad_k, vad_t0
            )
            current_silence = (i - silence_start_idx) * time_per_sample
            if current_silence >= silence_threshold:
                finalize_segment(speech_start_idx, silence_start_idx)
                current_speech_start = None
                speech_start_idx = None
                silence_start_idx = None

    if current_speech_start is not None:
        finalize_segment(speech_start_idx, len(waveform))

    return segments
