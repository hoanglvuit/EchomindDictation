import { useState, useRef, useEffect } from "react";
import WordDetailCard from "./WordDetailCard";

export default function SpellingQuestion({ item, onAnswer, onEdit, onDelete }) {
    const [userInput, setUserInput] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [resolved, setResolved] = useState(false);
    const [letterFeedback, setLetterFeedback] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
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
                // Missing characters
                feedback.push({
                    char: "_",
                    expected: normExpected[i],
                    correct: false,
                });
            } else {
                // Extra characters
                feedback.push({
                    char: normInput[i],
                    expected: "",
                    correct: false,
                });
            }
        }
        return feedback;
    };

    const handleSubmit = () => {
        if (!userInput.trim() || resolved) return;

        const isCorrect =
            normalizeWord(userInput) === normalizeWord(item.word);

        if (isCorrect) {
            setResolved(true);
            setLetterFeedback(null);
            const quality = attempts === 0 ? 5 : 3;
            setTimeout(() => onAnswer(quality), 1200);
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            const feedback = compareLetters(userInput, item.word);
            setLetterFeedback(feedback);

            if (newAttempts >= 2) {
                setResolved(true);
                setTimeout(() => onAnswer(0), 2000);
            } else {
                // After showing feedback, re-focus input
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="animate-fade-in space-y-5">
            {/* Question */}
            <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-100">
                <div className="text-xs text-teal-400 font-medium mb-1">
                    ✏️ Type the word that matches this definition:
                </div>
                <div className="text-base text-slate-700 leading-relaxed font-medium">
                    {item.general_meaning && (
                        <div className="mb-2 p-2 rounded bg-white/50 border border-teal-200 text-sm italic text-teal-700 whitespace-pre-wrap">
                            Core Idea: {item.general_meaning}
                        </div>
                    )}
                    {item.question_definitions.length === 1 ? (
                        <span>"{item.question_definitions[0]}"</span>
                    ) : (
                        <ol className="list-decimal list-inside space-y-1">
                            {item.question_definitions.map((def, i) => (
                                <li key={i}>{def}</li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>

            {/* Input */}
            <div>
                <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={resolved}
                    placeholder="Type the word here..."
                    className={`w-full px-4 py-3 rounded-xl bg-white border text-sm transition-all duration-200
            ${resolved && attempts === 0
                            ? "border-emerald-400 text-emerald-700"
                            : resolved
                                ? "border-rose-400 text-rose-700"
                                : "border-slate-200 text-slate-700 hover:border-indigo-300"
                        }
            placeholder:text-slate-300 disabled:opacity-60 text-center text-lg font-semibold tracking-wide`}
                    autoComplete="off"
                    spellCheck="false"
                />
            </div>

            {/* Letter-by-letter feedback */}
            {letterFeedback && !resolved && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 animate-fade-in">
                    <div className="text-xs text-slate-400 mb-2 font-medium">
                        Letter check:
                    </div>
                    <div className="flex justify-center gap-1 flex-wrap">
                        {letterFeedback.map((l, i) => (
                            <span
                                key={i}
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
                    {!resolved && (
                        <div className="text-center mt-2 text-xs text-amber-500">
                            ⚠ Some letters are wrong. Try again!
                        </div>
                    )}
                </div>
            )}

            {/* Submit button */}
            {!resolved && (
                <div className="flex justify-center">
                    <button
                        onClick={handleSubmit}
                        disabled={!userInput.trim()}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-500 to-emerald-500
              text-white hover:from-teal-600 hover:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all cursor-pointer"
                    >
                        ✓ Check Spelling
                    </button>
                </div>
            )}

            {/* Result feedback */}
            {resolved && (
                <div
                    className={`p-3 rounded-xl text-sm text-center animate-fade-in ${attempts === 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : attempts === 1
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                >
                    {attempts === 0 && "🎉 Perfect spelling!"}
                    {attempts === 1 && "✅ Correct on second try!"}
                    {attempts >= 2 && (
                        <>
                            ❌ The correct spelling is:{" "}
                            <span className="font-bold tracking-wider">
                                {item.word}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Show correct answer letters after fail */}
            {resolved && attempts >= 2 && (
                <div className="flex justify-center gap-1 animate-fade-in">
                    {item.word.split("").map((ch, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center justify-center w-8 h-10 rounded-lg text-base font-bold
                border-2 bg-emerald-50 border-emerald-300 text-emerald-700 quiz-pop"
                        >
                            {ch}
                        </span>
                    ))}
                </div>
            )}

            {/* Full word details after resolution */}
            {resolved && (
                <WordDetailCard item={item} onEdit={onEdit} onDelete={onDelete} />
            )}
        </div>
    );
}
