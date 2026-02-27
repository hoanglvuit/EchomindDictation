import { useState, useRef } from "react";
import { uploadAudio } from "../api";

export default function HomePage({ sessions, onStartSession, onRefresh, onOpenVocab }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const data = await uploadAudio(file);
            if (data.total === 0) {
                alert("No speech segments detected.");
                return;
            }
            onStartSession(data.session_name, data.total);
        } catch (err) {
            alert("Upload failed: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center pt-8 pb-2">
                <h1 className="text-4xl font-extrabold tracking-tight">
                    <span className="text-slate-800">🎧 English </span>
                    <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                        Listening
                    </span>
                    <span className="text-slate-800"> Dictation</span>
                </h1>
                <p className="text-slate-400 mt-2 text-sm">
                    Practice your English listening skills with AI-powered dictation
                </p>

                {/* Vocab button */}
                <button
                    onClick={onOpenVocab}
                    className="mt-3 px-5 py-2 rounded-full text-sm font-medium
            bg-violet-100 text-violet-600 hover:bg-violet-200 hover:text-violet-700
            transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5"
                >
                    📖 My Vocabulary
                </button>
            </div>

            {/* Past Sessions */}
            {sessions.length > 0 && (
                <div className="glass-card p-6 animate-slide-up">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <span>📂</span> Past Sessions
                    </h2>
                    <div className="space-y-2">
                        {sessions.map((s) => (
                            <div
                                key={s.name}
                                className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/60 hover:bg-indigo-100/80 transition-all duration-200 group"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-slate-700 truncate">
                                        {s.original_filename}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {s.segment_count} segments ·{" "}
                                        {s.created_at?.split("T")[0]}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onStartSession(s.name, s.segment_count)}
                                    className="ml-3 px-4 py-1.5 rounded-lg text-sm font-medium
                    bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500 hover:text-white
                    transition-all duration-200 cursor-pointer whitespace-nowrap"
                                >
                                    Practice →
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload */}
            <div className="glass-card p-6 animate-slide-up">
                <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span>📤</span> Upload New Audio
                </h2>
                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
            ${dragOver
                            ? "border-indigo-400 bg-indigo-50"
                            : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50"
                        }`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        if (e.dataTransfer.files.length > 0) {
                            setFile(e.dataTransfer.files[0]);
                        }
                    }}
                >
                    <div className="text-4xl mb-3">📁</div>
                    <p className="text-slate-500 text-sm">
                        Drop audio file here or click to select
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                        MP3, WAV, FLAC, etc.
                    </p>
                    {file && (
                        <div className="mt-3 text-indigo-600 text-sm font-medium">
                            {file.name}
                        </div>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files.length > 0) setFile(e.target.files[0]);
                        }}
                    />
                </div>
                <div className="text-center mt-4">
                    <button
                        disabled={!file || uploading}
                        onClick={handleUpload}
                        className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
              bg-gradient-to-r from-indigo-500 to-violet-500 text-white
              hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none cursor-pointer"
                    >
                        {uploading ? (
                            <span className="flex items-center gap-2">
                                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </span>
                        ) : (
                            "⬆ Upload & Process"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
