"""
English Listening Dictation — Flask Web App
Models are loaded on-demand and unloaded after processing to save RAM.
"""

import os
import re
import json
import gc
import tempfile
from datetime import datetime

from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

VAD_MODEL_PATH = os.path.join(BASE_DIR, "vad-model", "silero_vad.onnx")
ASR_DIR = os.path.join(BASE_DIR, "sherpa-onnx-whisper-distil-small.en")

print("Server ready. Models will load on first upload.")


# ============================================================
# Text normalization
# ============================================================
def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ============================================================
# Session helpers
# ============================================================
def sanitize_name(name: str) -> str:
    name = os.path.splitext(name)[0]
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    return name.strip(". ") or "untitled"


def load_session_db():
    db_path = os.path.join(SESSIONS_DIR, "sessions_db.json")
    if os.path.exists(db_path):
        with open(db_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_session_db(db):
    db_path = os.path.join(SESSIONS_DIR, "sessions_db.json")
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def load_session_metadata(session_name):
    meta_path = os.path.join(SESSIONS_DIR, session_name, "metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


# ============================================================
# Routes
# ============================================================
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/sessions", methods=["GET"])
def list_sessions():
    db = load_session_db()
    sessions_list = []
    for name, info in db.items():
        sessions_list.append(
            {
                "name": name,
                "original_filename": info.get("original_filename", name),
                "created_at": info.get("created_at", ""),
                "segment_count": info.get("segment_count", 0),
            }
        )
    sessions_list.sort(key=lambda x: x["created_at"], reverse=True)
    return jsonify({"sessions": sessions_list})


@app.route("/load/<session_name>", methods=["GET"])
def load_session(session_name):
    meta = load_session_metadata(session_name)
    if meta is None:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"session_name": session_name, "total": len(meta["segments"])})


@app.route("/segment/<session_name>/<int:segment_id>", methods=["GET"])
def get_segment(session_name, segment_id):
    meta = load_session_metadata(session_name)
    if meta is None:
        return jsonify({"error": "Session not found"}), 404
    if segment_id < 0 or segment_id >= len(meta["segments"]):
        return jsonify({"error": "Invalid segment"}), 400
    seg = meta["segments"][segment_id]
    return jsonify(
        {
            "id": seg["id"],
            "audio_url": f"/audio/{session_name}/{seg['filename']}",
            "start_time": seg["start_time"],
            "end_time": seg["end_time"],
        }
    )


@app.route("/audio/<session_name>/<filename>")
def serve_audio(session_name, filename):
    return send_from_directory(os.path.join(SESSIONS_DIR, session_name), filename)


@app.route("/upload", methods=["POST"])
def upload():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    session_name = sanitize_name(audio_file.filename)

    # Already processed?
    db = load_session_db()
    if session_name in db:
        print(f"Session '{session_name}' already exists on disk.")
        meta = load_session_metadata(session_name)
        return jsonify(
            {
                "session_name": session_name,
                "total": len(meta["segments"]),
                "cached": True,
            }
        )

    # Create session directory
    session_dir = os.path.join(SESSIONS_DIR, session_name)
    os.makedirs(session_dir, exist_ok=True)

    # Save to temp
    suffix = os.path.splitext(audio_file.filename)[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    audio_file.save(tmp.name)
    tmp.close()

    try:
        # Load models
        from asr_engine import WhisperOnnxModel, load_tokens, process_audio

        print("Loading models into RAM...")
        asr_model = WhisperOnnxModel(
            encoder_path=os.path.join(ASR_DIR, "distil-small.en-encoder.onnx"),
            decoder_path=os.path.join(ASR_DIR, "distil-small.en-decoder.onnx"),
        )
        token_table = load_tokens(os.path.join(ASR_DIR, "distil-small.en-tokens.txt"))
        print(f"Loaded {len(token_table)} tokens.")

        print(f"Processing: {audio_file.filename} -> session '{session_name}'")
        segments = process_audio(
            tmp.name, VAD_MODEL_PATH, asr_model, token_table, session_dir
        )

        # Unload models — free RAM
        del asr_model
        del token_table
        gc.collect()
        print("Models unloaded from RAM.")

    finally:
        os.unlink(tmp.name)

    # Save metadata
    metadata = {
        "name": session_name,
        "original_filename": audio_file.filename,
        "created_at": datetime.now().isoformat(),
        "segments": segments,
    }
    with open(os.path.join(session_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    db[session_name] = {
        "original_filename": audio_file.filename,
        "created_at": metadata["created_at"],
        "segment_count": len(segments),
    }
    save_session_db(db)

    print(f"Done! {len(segments)} segments saved to sessions/{session_name}/")
    return jsonify(
        {
            "session_name": session_name,
            "total": len(segments),
            "cached": False,
        }
    )


@app.route("/check", methods=["POST"])
def check():
    data = request.get_json()
    session_name = data.get("session_name")
    segment_id = data.get("segment_id")
    user_text = data.get("user_text", "")

    meta = load_session_metadata(session_name)
    if meta is None:
        return jsonify({"error": "Invalid session"}), 400
    if segment_id < 0 or segment_id >= len(meta["segments"]):
        return jsonify({"error": "Invalid segment"}), 400

    expected = meta["segments"][segment_id]["transcript"]
    norm_user = normalize_text(user_text)
    norm_expected = normalize_text(expected)

    correct = norm_user == norm_expected
    result = {"correct": correct}

    if correct:
        result["expected"] = expected
    else:
        prefix_len = 0
        for a, b in zip(norm_expected, norm_user):
            if a == b:
                prefix_len += 1
            else:
                break
        result["matching_prefix"] = norm_expected[:prefix_len]

    return jsonify(result)


@app.route("/answer", methods=["POST"])
def answer():
    data = request.get_json()
    session_name = data.get("session_name")
    segment_id = data.get("segment_id")

    meta = load_session_metadata(session_name)
    if meta is None:
        return jsonify({"error": "Invalid session"}), 400
    if segment_id < 0 or segment_id >= len(meta["segments"]):
        return jsonify({"error": "Invalid segment"}), 400

    return jsonify({"expected": meta["segments"][segment_id]["transcript"]})


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
