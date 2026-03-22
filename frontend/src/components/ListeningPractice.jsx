import { useState, useEffect, useCallback, useRef } from "react";
import { getListeningPractice, submitListeningPractice } from "../api";

export default function ListeningPractice({ onBack }) {
    const [items, setItems] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState([]); // { word, quality }
    const [finished, setFinished] = useState(false);
    const [waitingNext, setWaitingNext] = useState(false);

    // Per-question state
    const [userInput, setUserInput] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [resolved, setResolved] = useState(false);
    const [letterFeedback, setLetterFeedback] = useState(null);

    const inputRef = useRef(null);
    const audioRef = useRef(null);

    const fetchPractice = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getListeningPractice();
            const rawItems = data.items || [];
            // Fisher-Yates shuffle
            const shuffled = [...rawItems];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setItems(shuffled);
        } catch (err) {
            console.error("Failed to load listening practice:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPractice(); }, [fetchPractice]);

    const parseAudios = (audioStr) => {
        if (!audioStr) return [];
        try {
            const parsed = JSON.parse(audioStr);
            if (Array.isArray(parsed)) return parsed.filter(a => a.audio_url);
            return [{ pos: '', audio_url: audioStr }];
        } catch {
            return [{ pos: '', audio_url: audioStr }];
        }
    };

    const playAudio = useCallback((specificUrl = null) => {
        const current = items[currentIdx];
        if (!current?.audio_url) return;
        
        let urlToPlay = specificUrl;
        if (!urlToPlay) {
            const audios = parseAudios(current.audio_url);
            if (audios.length === 0) return;
            urlToPlay = audios[0].audio_url;
        }

        if (audioRef.current) {
            audioRef.current.pause();
        }
        const audio = new Audio(urlToPlay);
        audioRef.current = audio;
        audio.play().catch(() => {});
    }, [items, currentIdx]);

    // Auto-play audio when question loads
    useEffect(() => {
        if (!loading && items.length > 0 && !finished) {
            setTimeout(() => {
                playAudio();
                inputRef.current?.focus();
            }, 300);
        }
    }, [currentIdx, loading, items.length, finished, playAudio]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => { if (audioRef.current) audioRef.current.pause(); };
    }, []);

    const normalizeWord = (w) => w.trim().toLowerCase();

    const compareLetters = (input, expected) => {
        const normInput = normalizeWord(input);
        const normExpected = normalizeWord(expected);
        const feedback = [];
        const maxLen = Math.max(normInput.length, normExpected.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < normInput.length && i < normExpected.length) {
                feedback.push({
                    char: normInput[i],
                    expected: normExpected[i],
                    correct: normInput[i] === normExpected[i],
                });
            } else if (i < normExpected.length) {
                feedback.push({ char: "_", expected: normExpected[i], correct: false });
            } else {
                feedback.push({ char: normInput[i], expected: "", correct: false });
            }
        }
        return feedback;
    };

    const handleSubmit = async () => {
        if (!userInput.trim() || resolved) return;
        const current = items[currentIdx];
        const isCorrect = normalizeWord(userInput) === normalizeWord(current.word);

        if (isCorrect) {
            setResolved(true);
            setLetterFeedback(null);
            const quality = 5 - attempts; // attempt 0→5, 1→4, 2→3, 3→2, 4→1
            // Submit SM-2 update
            try { await submitListeningPractice(current.id, quality); } catch (err) { console.error(err); }
            setResults((prev) => [...prev, { word: current.word, quality }]);
            setWaitingNext(true);
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            const feedback = compareLetters(userInput, current.word);
            setLetterFeedback(feedback);

            if (newAttempts >= 5) {
                // All 5 attempts failed
                setResolved(true);
                try { await submitListeningPractice(current.id, 0); } catch (err) { console.error(err); }
                setResults((prev) => [...prev, { word: current.word, quality: 0 }]);
                setWaitingNext(true);
            } else {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (waitingNext) {
                goNext();
            } else {
                handleSubmit();
            }
        }
    };

    const goNext = () => {
        setWaitingNext(false);
        setUserInput("");
        setAttempts(0);
        setResolved(false);
        setLetterFeedback(null);
        const next = currentIdx + 1;
        if (next >= items.length) {
            setFinished(true);
        } else {
            setCurrentIdx(next);
        }
    };

    const current = items[currentIdx];
    const progressPct = items.length > 0 ? ((currentIdx + 1) / items.length) * 100 : 0;

    // Summary stats
    const perfect = results.filter((r) => r.quality === 5).length;
    const good = results.filter((r) => r.quality >= 3 && r.quality < 5).length;
    const weak = results.filter((r) => r.quality >= 1 && r.quality < 3).length;
    const failed = results.filter((r) => r.quality === 0).length;

    // Loading
    if (loading) {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto pt-6">
                <div className="glass-card p-12 text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Loading listening practice...</p>
                </div>
            </div>
        );
    }

    // No items
    if (!loading && items.length === 0) {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto pt-6 space-y-4">
                <button onClick={onBack} className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer">
                    ← Back
                </button>
                <div className="glass-card p-12 text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No listening words due!</h3>
                    <p className="text-slate-400 text-sm">All your listening vocab is up to date. Come back tomorrow!</p>
                </div>
            </div>
        );
    }

    // Finished
    if (finished) {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto pt-6 space-y-4">
                <div className="glass-card p-6 text-center">
                    <div className="text-5xl mb-4">🏆</div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Listening Practice Complete!</h2>
                    <p className="text-slate-500 text-sm mb-6">
                        You reviewed {results.length} word{results.length !== 1 ? "s" : ""}
                    </p>

                    <div className="grid grid-cols-4 gap-2 mb-6">
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <div className="text-2xl font-bold text-emerald-600">{perfect}</div>
                            <div className="text-[10px] text-emerald-500 mt-1">🎉 1st try</div>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                            <div className="text-2xl font-bold text-blue-600">{good}</div>
                            <div className="text-[10px] text-blue-500 mt-1">✅ 2-3 tries</div>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <div className="text-2xl font-bold text-amber-600">{weak}</div>
                            <div className="text-[10px] text-amber-500 mt-1">⚠️ 4-5 tries</div>
                        </div>
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                            <div className="text-2xl font-bold text-rose-600">{failed}</div>
                            <div className="text-[10px] text-rose-500 mt-1">❌ Failed</div>
                        </div>
                    </div>

                    {/* Result details */}
                    <div className="space-y-2 text-left mb-6">
                        {results.map((r, i) => (
                            <div key={i}
                                className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm ${
                                    r.quality >= 4 ? "bg-emerald-50/60 text-emerald-700"
                                    : r.quality >= 2 ? "bg-amber-50/60 text-amber-700"
                                    : "bg-rose-50/60 text-rose-700"
                                }`}
                            >
                                <span className="font-medium">{r.word}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs opacity-60">
                                        {r.quality === 5 ? "1st try" :
                                         r.quality === 4 ? "2nd try" :
                                         r.quality === 3 ? "3rd try" :
                                         r.quality === 2 ? "4th try" :
                                         r.quality === 1 ? "5th try" : "Failed"}
                                    </span>
                                    <span className="font-bold">{r.quality}/5</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button onClick={onBack}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500
                            text-white hover:from-orange-600 hover:to-amber-600 transition-all cursor-pointer"
                    >
                        ← Back to Listening Vocab
                    </button>
                </div>
            </div>
        );
    }

    // Active quiz
    const remainingAttempts = 5 - attempts;

    return (
        <div className="animate-fade-in max-w-2xl mx-auto space-y-4 pt-6">
            <div className="glass-card p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer">
                        ← Back
                    </button>
                    <div className="text-sm text-orange-600 font-medium">🎧 Listening Practice</div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                        {currentIdx + 1} / {items.length}
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full progress-shimmer rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-600">
                        Listening
                    </span>
                </div>

                {/* Audio section */}
                <div className="p-5 rounded-xl bg-orange-50/80 border border-orange-100 mb-5 text-center">
                    <div className="text-xs text-orange-400 font-medium mb-3">
                        🎧 Listen and type the word:
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                        {current && parseAudios(current.audio_url).map((a, i) => (
                            <button key={i} onClick={() => playAudio(a.audio_url)}
                                className="px-6 py-2.5 rounded-xl text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500
                                    text-white hover:from-orange-600 hover:to-amber-600 transition-all cursor-pointer shadow-sm"
                            >
                                🔊 Play {a.pos && a.pos !== "unknown" ? `(${a.pos.substring(0,3).toUpperCase()})` : ""}
                            </button>
                        ))}
                    </div>
                    {!resolved && (
                        <div className="mt-3 text-xs text-slate-400">
                            Attempts remaining: <span className="font-bold text-orange-500">{remainingAttempts}</span> / 5
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="mb-4">
                    <input
                        ref={inputRef}
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={resolved}
                        placeholder="Type the word you hear..."
                        className={`w-full px-4 py-3 rounded-xl bg-white border text-sm transition-all duration-200 text-center text-lg font-semibold tracking-wide
                            ${resolved && attempts === 0
                                ? "border-emerald-400 text-emerald-700"
                                : resolved
                                    ? attempts < 5 ? "border-amber-400 text-amber-700" : "border-rose-400 text-rose-700"
                                    : "border-slate-200 text-slate-700 hover:border-orange-300"
                            }
                            placeholder:text-slate-300 disabled:opacity-60`}
                        autoComplete="off"
                        spellCheck="false"
                    />
                </div>

                {/* Letter-by-letter feedback */}
                {letterFeedback && !resolved && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 animate-fade-in mb-4">
                        <div className="text-xs text-slate-400 mb-2 font-medium">Letter check:</div>
                        <div className="flex justify-center gap-1 flex-wrap">
                            {letterFeedback.map((l, i) => (
                                <span key={i}
                                    className={`inline-flex items-center justify-center w-8 h-10 rounded-lg text-base font-bold border-2 transition-all
                                        ${l.correct
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                            : "bg-rose-50 border-rose-300 text-rose-600 quiz-shake"
                                        }`}
                                >
                                    {l.char}
                                </span>
                            ))}
                        </div>
                        <div className="text-center mt-2 text-xs text-amber-500">
                            ⚠ Some letters are wrong. Try again! ({remainingAttempts} left)
                        </div>
                    </div>
                )}

                {/* Submit button */}
                {!resolved && (
                    <div className="flex justify-center">
                        <button onClick={handleSubmit} disabled={!userInput.trim()}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500
                                text-white hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed
                                transition-all cursor-pointer"
                        >
                            ✓ Check
                        </button>
                    </div>
                )}

                {/* Result feedback */}
                {resolved && (
                    <div className={`p-3 rounded-xl text-sm text-center animate-fade-in ${
                        attempts === 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : attempts < 5
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}>
                        {attempts === 0 && "🎉 Perfect! First try!"}
                        {attempts >= 1 && attempts < 5 && `✅ Correct on attempt ${attempts + 1}! Score: ${5 - attempts}/5`}
                        {attempts >= 5 && (
                            <>
                                ❌ The correct word is:{" "}
                                <span className="font-bold tracking-wider">{current.word}</span>
                            </>
                        )}
                    </div>
                )}

                {/* Show correct word letters after all attempts failed */}
                {resolved && attempts >= 5 && (
                    <div className="flex justify-center gap-1 mt-3 animate-fade-in">
                        {current.word.split("").map((ch, i) => (
                            <span key={i}
                                className="inline-flex items-center justify-center w-8 h-10 rounded-lg text-base font-bold
                                    border-2 bg-emerald-50 border-emerald-300 text-emerald-700 quiz-pop"
                            >
                                {ch}
                            </span>
                        ))}
                    </div>
                )}

                {/* Next button */}
                {waitingNext && (
                    <div className="text-center mt-5 animate-fade-in">
                        <button onClick={goNext}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500
                                text-white hover:from-orange-600 hover:to-amber-600 transition-all cursor-pointer"
                        >
                            {currentIdx + 1 >= items.length ? "See Results" : "Next →"}
                        </button>
                        <div className="text-xs text-slate-400 mt-2">
                            Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">Enter</kbd> to continue
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
