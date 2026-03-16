import { useState } from "react";

export default function GrammarMCQQuestion({ item, onAnswer }) {
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
            const quality = attempts === 0 ? 2 : 1;
            setTimeout(() => onAnswer(quality), 1200);
        } else {
            // Wrong
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            setWrongIds((prev) => new Set(prev).add(index));

            if (newAttempts >= 2) {
                setResolved(true);
                setTimeout(() => onAnswer(0), 1500);
            } else {
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
                    📖 Which structure matches this meaning?
                </div>
                <div className="text-base text-slate-700 leading-relaxed font-medium">
                    <div className="mb-2 p-2 rounded bg-white/50 border border-violet-200 text-sm italic text-violet-700">
                        Meaning: {item.meaning}
                    </div>
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
                            <span className="font-semibold">{option.structure}</span>
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
                            <span className="font-bold">{item.structure}</span>
                        </>
                    )}
                </div>
            )}

            {/* Full details after resolution */}
            {resolved && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 animate-fade-in mt-4">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-bold text-indigo-600">{item.structure}</span>
                    </div>
                    {item.meaning && (
                        <p className="text-sm text-slate-500 italic mb-3">{item.meaning}</p>
                    )}
                    {item.examples && item.examples.length > 0 && (
                        <div className="space-y-2">
                            {item.examples.map((ex, i) => (
                                <p key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-indigo-300">
                                    "{ex}"
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
