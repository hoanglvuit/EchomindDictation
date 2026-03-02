import { useState, useEffect, useRef, useCallback } from "react";
import { getSegment, showAnswer, saveProgress } from "../api";
import VocabForm from "./VocabForm";

export default function Exercise({
    sessionName,
    totalSegments,
    startIdx = 0,
    onComplete,
    onBack,
}) {
    const [currentIdx, setCurrentIdx] = useState(startIdx);
    const [segment, setSegment] = useState(null);
    const [userText, setUserText] = useState("");
    const [result, setResult] = useState(null);
    const [answerText, setAnswerText] = useState(null);
    const [answeredCorrectly, setAnsweredCorrectly] = useState(false);
    const [stats, setStats] = useState({ correct: 0, incorrect: 0, skipped: 0 });
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedWord, setSelectedWord] = useState(null);
    const [showVocab, setShowVocab] = useState(false);
    const [hint, setHint] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [allSegments, setAllSegments] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const audioRef = useRef(null);
    const inputRef = useRef(null);

    const normalizeText = (text) => {
        if (!text) return "";
        return text.toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    };

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
                setHint(null);
                setPlaybackRate(1.0); // Reset speed to 1.0 for each new segment

                if (audioRef.current) audioRef.current.pause();
                const audio = new Audio(`/api${seg.audio_url}`);
                audioRef.current = audio;
                audio.addEventListener("play", () => setIsPlaying(true));
                audio.addEventListener("pause", () => setIsPlaying(false));
                audio.addEventListener("ended", () => setIsPlaying(false));
                audio.addEventListener("timeupdate", () => {
                    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                });
                audio.addEventListener("loadedmetadata", () => {
                    if (audioRef.current) setDuration(audioRef.current.duration);
                });
                audio.addEventListener("canplaythrough", () => {
                    if (audioRef.current) {
                        audioRef.current.playbackRate = 1.0; // Always start at 1.0
                        audioRef.current.play().catch(() => { });
                    }
                }, { once: true });

                setTimeout(() => inputRef.current?.focus(), 100);
            } catch (err) {
                alert("Failed to load segment: " + err.message);
            }
        },
        [sessionName]
    );

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const results = await Promise.all(
                    Array.from({ length: totalSegments }, (_, i) => getSegment(sessionName, i))
                );
                setAllSegments(results);
            } catch (err) {
                console.error("Failed to fetch history:", err);
            } finally {
                setIsLoadingHistory(false);
            }
        };
        fetchHistory();
        loadSegment(startIdx);
        return () => { if (audioRef.current) audioRef.current.pause(); };
    }, [loadSegment, startIdx, sessionName, totalSegments]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.playbackRate = playbackRate;
                audioRef.current.play().catch(() => { });
            }
        }
    };

    const restartAudio = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.playbackRate = playbackRate;
            audioRef.current.play().catch(() => { });
        }
    };

    const pauseAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    };

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleSpeedChange = (rate) => {
        setPlaybackRate(rate);
        if (audioRef.current) {
            audioRef.current.playbackRate = rate;
        }
    };

    const formatSeconds = (secs) => {
        if (isNaN(secs)) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const handleCheck = () => {
        if (!userText.trim() || !segment) return;

        const normUser = normalizeText(userText);
        const normExpected = normalizeText(segment.transcript);

        const isCorrect = normUser === normExpected;

        if (isCorrect) {
            setResult({ correct: true, expected: segment.transcript });
            setAnswerText(segment.transcript);
            setAnsweredCorrectly(true);
            setStats((s) => ({ ...s, correct: s.correct + 1 }));
        } else {
            let prefixLen = 0;
            for (let i = 0; i < Math.min(normExpected.length, normUser.length); i++) {
                if (normExpected[i] === normUser[i]) {
                    prefixLen++;
                } else {
                    break;
                }
            }
            setResult({
                correct: false,
                matching_prefix: normExpected.substring(0, prefixLen)
            });
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

    const handleHint = () => {
        if (!segment) return;
        const normUser = normalizeText(userText);
        const normExpected = normalizeText(segment.transcript);

        let prefixLen = 0;
        for (let i = 0; i < Math.min(normExpected.length, normUser.length); i++) {
            if (normExpected[i] === normUser[i]) {
                prefixLen++;
            } else {
                break;
            }
        }

        const remaining = normExpected.substring(prefixLen).trim();
        if (!remaining) {
            setHint(null);
            return;
        }

        const nextWord = remaining.split(" ")[0];
        setHint(nextWord);
    };

    const nextSegment = () => {
        const next = currentIdx + 1;
        // Save progress
        saveProgress(sessionName, next).catch(() => { });
        if (next >= totalSegments) {
            if (audioRef.current) audioRef.current.pause();
            onComplete(stats);
        } else {
            setCurrentIdx(next);
            loadSegment(next);
        }
    };

    const prevSegment = () => {
        if (currentIdx > 0) {
            const prev = currentIdx - 1;
            saveProgress(sessionName, prev).catch(() => { });
            setCurrentIdx(prev);
            loadSegment(prev);
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
        const handleKeyDown = (e) => {
            // Disable app-wide shortcuts when vocab form or other overlays are active
            if (showVocab) return;

            // Handle only the Control key itself to restart
            if (e.key === "Control" && !e.altKey && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
                restartAudio();
            }
            if (e.key === "Enter" && answeredCorrectly) {
                handleNext();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    });

    const handleInputKeyDown = (e) => {
        if (e.key === "Enter" && !answeredCorrectly) {
            e.preventDefault();
            e.stopPropagation();
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

    const segmentsPerBlock = 50;
    const historyBlocks = [];
    for (let i = 0; i < currentIdx; i += segmentsPerBlock) {
        const block = allSegments.slice(i, Math.min(i + segmentsPerBlock, currentIdx));
        const combinedText = block.map(s => s.transcript).join(" ");
        if (combinedText.trim()) historyBlocks.push(combinedText);
    }

    return (
        <div className="min-h-screen py-10 px-4 relative overflow-x-hidden">
            {/* Background History - Left Side */}
            <div className="fixed right-[calc(50%+345px)] top-32 bottom-24 w-[550px] hidden lg:block overflow-y-auto scrollbar-hide text-right">
                <div className="flex flex-col gap-16 py-6">
                    {historyBlocks.filter((_, i) => i % 2 === 0).map((text, i) => (
                        <div key={i} className="animate-fade-in group">
                            <div className="text-[11px] leading-relaxed text-slate-700 font-bold opacity-60 hover:opacity-100 transition-opacity p-2">
                                {text}
                            </div>
                            {i < Math.floor((historyBlocks.length - 1) / 2) && (
                                <div className="mt-8 border-b border-slate-200/50 w-32 ml-auto" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Background History - Right Side */}
            <div className="fixed left-[calc(50%+345px)] top-32 bottom-24 w-[550px] hidden lg:block overflow-y-auto scrollbar-hide text-left">
                <div className="flex flex-col gap-16 py-6">
                    {historyBlocks.filter((_, i) => i % 2 !== 0).map((text, i) => (
                        <div key={i} className="animate-fade-in group">
                            <div className="text-[11px] leading-relaxed text-slate-700 font-bold opacity-60 hover:opacity-100 transition-opacity p-2">
                                {text}
                            </div>
                            {i < Math.floor(historyBlocks.length / 2 - 1) && (
                                <div className="mt-8 border-b border-slate-200/50 w-32 mr-auto" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Mobile/Small Screen History - Horizontal scroll */}
            <div className="lg:hidden max-w-2xl mx-auto mb-6 px-4">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Recent Context</div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {allSegments.slice(0, currentIdx).reverse().map((seg, i) => (
                        <div key={i} className="flex-shrink-0 max-w-[200px] text-[10px] text-slate-700 font-bold bg-white/50 backdrop-blur-md p-2 rounded-xl border border-white/30 italic">
                            {seg.transcript}
                        </div>
                    ))}
                </div>
            </div>

            <div className="animate-fade-in max-w-2xl mx-auto space-y-4 pt-6 relative z-10">
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

                    {/* Audio Controls */}
                    <div className="flex justify-center items-center gap-4 mb-5">
                        {!isPlaying ? (
                            <button
                                onClick={togglePlay}
                                className="relative px-8 py-2.5 rounded-xl font-semibold text-sm bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-all duration-200 cursor-pointer flex items-center gap-2"
                            >
                                <span>▶</span> Play
                            </button>
                        ) : (
                            <button
                                onClick={togglePlay}
                                className="relative px-8 py-2.5 rounded-xl font-semibold text-sm bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all duration-200 cursor-pointer flex items-center gap-2"
                            >
                                <span>⏸</span> Pause
                            </button>
                        )}

                        <span className="text-xs text-slate-400 self-center">
                            or press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-xs border border-slate-200">Ctrl</kbd> to restart
                        </span>
                    </div>

                    {/* Seekbar */}
                    <div className="mb-5 space-y-1">
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                step="0.01"
                                value={currentTime}
                                onChange={handleSeek}
                                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                            <span>{formatSeconds(currentTime)}</span>
                            <span>{formatSeconds(duration)}</span>
                        </div>
                    </div>

                    {/* Speed Controls */}
                    <div className="flex items-center justify-center gap-2 mb-6 p-2 rounded-xl bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Speed:</span>
                        {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
                            <button
                                key={rate}
                                onClick={() => handleSpeedChange(rate)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all
                ${playbackRate === rate
                                        ? "bg-white text-indigo-600 shadow-sm border border-indigo-100 scale-110"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                    }`}
                            >
                                {rate}x
                            </button>
                        ))}
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

                    {/* Hint display */}
                    {hint && (
                        <div className="mb-4 p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 animate-fade-in flex items-center gap-2">
                            <span className="text-amber-400">💡</span>
                            <span>Next word starts with: <span className="font-bold underline">{hint}</span></span>
                            <button
                                onClick={() => setHint(null)}
                                className="ml-auto text-amber-400 hover:text-amber-600 p-1"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Action buttons */}
                    {!answeredCorrectly && !answerShown && (
                        <div className="flex gap-2 justify-center">
                            <button onClick={handleCheck} disabled={!userText.trim()}
                                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white
                hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                ✓ Submit
                            </button>
                            <button onClick={prevSegment} disabled={currentIdx === 0}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-500
                hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 transition-all cursor-pointer"
                            >
                                ← Prev
                            </button>
                            <button onClick={handleSkip}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-500
                hover:bg-slate-200 hover:text-slate-700 transition-all cursor-pointer"
                            >
                                Skip →
                            </button>
                            <button onClick={handleHint}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-100 text-amber-600
                hover:bg-amber-200 hover:text-amber-700 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                💡 Hint
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
                                <div className="flex gap-3 justify-center mt-3">
                                    <button onClick={prevSegment} disabled={currentIdx === 0}
                                        className="px-5 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-500
                    hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 transition-all cursor-pointer"
                                    >
                                        ← Prev
                                    </button>
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
