import { useState } from "react";

export default function MCQQuestion({ item, onAnswer }) {
    const [selected, setSelected] = useState(null);
    const [attempts, setAttempts] = useState(0);
    const [resolved, setResolved] = useState(false);
    const [wrongIds, setWrongIds] = useState(new Set());

    const handleSelect = (option, index) => {
        if (resolved) return;

        setSelected(index);

        if (option.correct) {
            // Correct!
            setResolved(true);
            const quality = attempts === 0 ? 2 : 1; // 1st try = 2, 2nd try = 1
            setTimeout(() => onAnswer(quality), 1200);
        } else {
            // Wrong
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            setWrongIds((prev) => new Set(prev).add(index));

            if (newAttempts >= 2) {
                // Failed after 2 wrong attempts
                setResolved(true);
                setTimeout(() => onAnswer(0), 1500);
            } else {
                // Allow one more try — clear selection after a short delay
                setTimeout(() => setSelected(null), 600);
            }
        }
    };

    const getOptionClass = (option, index) => {
        const base =
            "w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-300 border cursor-pointer";

        if (resolved && option.correct) {
            return `${base} bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-200 quiz-pop`;
        }
        if (wrongIds.has(index)) {
            return `${base} bg-rose-50 border-rose-300 text-rose-400 opacity-60 cursor-not-allowed quiz-shake`;
        }
        if (selected === index) {
            return `${base} bg-indigo-50 border-indigo-400 text-indigo-700`;
        }
        if (resolved) {
            return `${base} bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed`;
        }
        return `${base} bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50`;
    };

    return (
        <div className="animate-fade-in space-y-5">
            {/* Question */}
            <div className="p-4 rounded-xl bg-violet-50/80 border border-violet-100">
                <div className="text-xs text-violet-400 font-medium mb-1">
                    📖 Which word matches this definition?
                </div>
                <div className="text-base text-slate-700 leading-relaxed font-medium">
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

            {/* Options */}
            <div className="space-y-2.5">
                {item.options.map((option, i) => (
                    <button
                        key={i}
                        onClick={() => handleSelect(option, i)}
                        disabled={resolved || wrongIds.has(i)}
                        className={getOptionClass(option, i)}
                    >
                        <span className="inline-flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-bold">
                                {String.fromCharCode(65 + i)}
                            </span>
                            <span className="font-semibold">{option.word}</span>
                        </span>
                        {resolved && option.correct && (
                            <span className="float-right text-emerald-500">✓</span>
                        )}
                        {wrongIds.has(i) && (
                            <span className="float-right text-rose-400">✗</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Feedback */}
            {resolved && (
                <div
                    className={`p-3 rounded-xl text-sm text-center animate-fade-in ${attempts === 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : attempts === 1
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                >
                    {attempts === 0 && "🎉 Perfect! Got it on the first try!"}
                    {attempts === 1 && "✅ Correct on second try — keep practicing!"}
                    {attempts >= 2 && (
                        <>
                            ❌ The correct answer was:{" "}
                            <span className="font-bold">{item.word}</span>
                        </>
                    )}
                </div>
            )}

            {/* Attempt indicator */}
            {!resolved && attempts > 0 && (
                <div className="text-center text-xs text-amber-500 animate-fade-in">
                    ⚠ Wrong! You have 1 more attempt
                </div>
            )}

            {/* Full word details after resolution */}
            {resolved && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 animate-fade-in">
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-lg font-bold text-indigo-600">{item.word}</span>
                        {item.pronunciation && (
                            <span className="text-sm text-slate-400 italic">{item.pronunciation}</span>
                        )}
                    </div>
                    {item.definitions && item.definitions.length > 0 && (
                        <div className="space-y-2">
                            {item.definitions.map((d, i) => (
                                <div key={d.id || i} className="pl-3 border-l-2 border-indigo-300">
                                    {d.definition && (
                                        <p className="text-sm text-slate-700">
                                            <span className="font-medium text-indigo-500">Def:</span>{" "}
                                            {d.definition}
                                        </p>
                                    )}
                                    {d.example && (
                                        <p className="text-sm text-slate-400 italic mt-0.5">
                                            "{d.example}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
