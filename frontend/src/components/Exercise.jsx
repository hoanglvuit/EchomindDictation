import { useState, useEffect, useRef, useCallback } from "react";
import { getSegment, checkAnswer, showAnswer } from "../api";
import VocabForm from "./VocabForm";

export default function Exercise({
    sessionName,
    totalSegments,
    onComplete,
    onBack,
}) {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [segment, setSegment] = useState(null);
    const [userText, setUserText] = useState("");
    const [result, setResult] = useState(null);
    const [answerText, setAnswerText] = useState(null);
    const [answeredCorrectly, setAnsweredCorrectly] = useState(false);
    const [stats, setStats] = useState({ correct: 0, incorrect: 0, skipped: 0 });
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedWord, setSelectedWord] = useState(null);
    const [showVocab, setShowVocab] = useState(false);

    const audioRef = useRef(null);
    const inputRef = useRef(null);

    const answerShown = answerText !== null;

    const loadSegment = useCallback(
        async (idx) => {
            try {
                const seg = await getSegment(sessionName, idx);
                setSegment(seg);
                setUserText("");
                setResult(null);
                setAnswerText(null);
                setAnsweredCorrectly(false);
                setSelectedWord(null);
                setShowVocab(false);

                if (audioRef.current) audioRef.current.pause();
                const audio = new Audio(`/api${seg.audio_url}`);
                audioRef.current = audio;
                audio.addEventListener("play", () => setIsPlaying(true));
                audio.addEventListener("pause", () => setIsPlaying(false));
                audio.addEventListener("ended", () => setIsPlaying(false));
                audio.addEventListener("canplaythrough", () => audio.play().catch(() => { }), { once: true });

                setTimeout(() => inputRef.current?.focus(), 100);
            } catch (err) {
                alert("Failed to load segment: " + err.message);
            }
        },
        [sessionName]
    );

    useEffect(() => {
        loadSegment(0);
        return () => { if (audioRef.current) audioRef.current.pause(); };
    }, [loadSegment]);

    const playAudio = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => { });
        }
    };

    const handleCheck = async () => {
        if (!userText.trim()) return;
        try {
            const data = await checkAnswer(sessionName, currentIdx, userText);
            setResult(data);
            if (data.correct) {
                setAnswerText(data.expected);
                setAnsweredCorrectly(true);
                setStats((s) => ({ ...s, correct: s.correct + 1 }));
            }
        } catch (err) {
            alert("Check failed: " + err.message);
        }
    };

    const handleShowAnswer = async () => {
        try {
            const data = await showAnswer(sessionName, currentIdx);
            setAnswerText(data.expected);
        } catch (err) {
            alert("Failed: " + err.message);
        }
    };

    const nextSegment = () => {
        const next = currentIdx + 1;
        if (next >= totalSegments) {
            if (audioRef.current) audioRef.current.pause();
            onComplete(stats);
        } else {
            setCurrentIdx(next);
            loadSegment(next);
        }
    };

    const handleSkip = () => {
        setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
        nextSegment();
    };

    const handleNext = () => {
        if (!answeredCorrectly) {
            setStats((s) => ({ ...s, incorrect: s.incorrect + 1 }));
        }
        nextSegment();
    };

    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Control" && !e.altKey && !e.shiftKey && !e.metaKey) playAudio();
            if (e.key === "Enter" && answeredCorrectly && !showVocab) nextSegment();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    });

    const handleInputKeyDown = (e) => {
        if (e.key === "Enter" && !answeredCorrectly) {
            e.preventDefault();
            handleCheck();
        }
    };

    const handleWordClick = (word) => {
        const clean = word.replace(/[^a-zA-Z'-]/g, "");
        if (!clean) return;
        setSelectedWord(clean);
        setShowVocab(true);
    };

    const progressPct = ((currentIdx + 1) / totalSegments) * 100;

    return (
        <div className="animate-fade-in max-w-2xl mx-auto space-y-4 pt-6">
            <div className="glass-card p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer">
                        ← Back
                    </button>
                    <div className="text-sm text-indigo-600 font-medium">📁 {sessionName}</div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                        {currentIdx + 1} / {totalSegments}
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full progress-shimmer rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>

                {/* Time badge */}
                {segment && (
                    <div className="text-center mb-4">
                        <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-500 font-mono">
                            {segment.start_time} → {segment.end_time}
                        </span>
                    </div>
                )}

                {/* Play button */}
                <div className="flex justify-center mb-5">
                    <button
                        onClick={playAudio}
                        className={`relative px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer
              ${isPlaying
                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 pulse-ring"
                                : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200 hover:text-indigo-700"
                            }`}
                    >
                        {isPlaying ? "🔊 Playing..." : "▶ Play"}
                    </button>
                    <span className="text-xs text-slate-400 self-center ml-3">
                        or press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-xs border border-slate-200">Ctrl</kbd>
                    </span>
                </div>

                {/* Input */}
                <div className="mb-4">
                    <label className="block text-xs text-slate-500 mb-1.5 font-medium">Type what you hear:</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={userText}
                        onChange={(e) => setUserText(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        disabled={answeredCorrectly}
                        placeholder="Type the sentence here..."
                        className={`w-full px-4 py-3 rounded-xl bg-white border text-sm transition-all duration-200
              ${result?.correct
                                ? "border-emerald-400 text-emerald-700"
                                : result && !result.correct
                                    ? "border-rose-400 text-rose-700"
                                    : "border-slate-200 text-slate-700 hover:border-indigo-300"
                            }
              placeholder:text-slate-300 disabled:opacity-60`}
                        autoComplete="off"
                    />
                </div>

                {/* Action buttons */}
                {!answeredCorrectly && !answerShown && (
                    <div className="flex gap-3 justify-center">
                        <button onClick={handleCheck} disabled={!userText.trim()}
                            className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white
                hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            ✓ Submit
                        </button>
                        <button onClick={handleSkip}
                            className="px-5 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-500
                hover:bg-slate-200 hover:text-slate-700 transition-all cursor-pointer"
                        >
                            Skip →
                        </button>
                    </div>
                )}

                {/* Result feedback */}
                {result && (
                    <div className={`mt-4 p-3 rounded-xl text-sm text-center animate-fade-in ${result.correct
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                        {result.correct ? (
                            <>✅ Correct! Press <kbd className="px-1.5 py-0.5 rounded bg-white text-xs border border-slate-200">Enter</kbd> to continue</>
                        ) : (
                            "❌ Incorrect — try again!"
                        )}
                    </div>
                )}

                {/* Prefix hint */}
                {result && !result.correct && result.matching_prefix !== undefined && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 animate-fade-in">
                        <strong>Hint: </strong>
                        {result.matching_prefix.length > 0 ? (
                            <><span className="text-amber-800 font-medium">{result.matching_prefix}</span><span className="text-amber-400 animate-pulse">…</span></>
                        ) : (
                            <span className="text-slate-400 text-xs">(first character is wrong)</span>
                        )}
                    </div>
                )}

                {/* Hint buttons */}
                {result && !result.correct && !answerShown && (
                    <div className="flex gap-3 justify-center mt-4 animate-fade-in">
                        <button onClick={handleShowAnswer}
                            className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-100 text-violet-600
                hover:bg-violet-200 hover:text-violet-700 transition-all cursor-pointer"
                        >
                            👁 Show Answer
                        </button>
                        <button onClick={handleNext}
                            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-500
                hover:bg-slate-200 hover:text-slate-700 transition-all cursor-pointer"
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* Answer display with clickable words */}
                {answerText && (
                    <div className="mt-4 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 animate-fade-in">
                        <div className="text-xs text-slate-400 mb-2 font-medium">
                            Answer: <span className="text-slate-300 text-[10px]">(click a word to save vocabulary)</span>
                        </div>
                        <div className="text-base text-slate-700 leading-relaxed flex flex-wrap gap-1">
                            {answerText.split(/\s+/).map((word, i) => (
                                <span
                                    key={i}
                                    className={`word-clickable ${selectedWord === word.replace(/[^a-zA-Z'-]/g, "") ? "selected" : ""}`}
                                    onClick={() => handleWordClick(word)}
                                >
                                    {word}
                                </span>
                            ))}
                        </div>

                        {!answeredCorrectly && (
                            <div className="text-center mt-3">
                                <button onClick={handleNext}
                                    className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-100 text-indigo-600
                    hover:bg-indigo-200 hover:text-indigo-700 transition-all cursor-pointer"
                                >
                                    Next →
                                </button>
                            </div>
                        )}

                        {answeredCorrectly && (
                            <div className="text-center mt-3 text-xs text-slate-400">
                                Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">Enter</kbd> to continue
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Vocab Form */}
            {showVocab && selectedWord && (
                <VocabForm
                    word={selectedWord}
                    onClose={() => { setShowVocab(false); setSelectedWord(null); }}
                    onSaved={() => { setShowVocab(false); setSelectedWord(null); }}
                />
            )}
        </div>
    );
}
