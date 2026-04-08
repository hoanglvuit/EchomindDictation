import { useState, useEffect, useCallback } from "react";
import { getGrammarPractice, submitGrammarPractice, deleteGrammar } from "../../api";
import GrammarMCQQuestion from "./GrammarMCQQuestion";
import GrammarSpellingQuestion from "./GrammarSpellingQuestion";
import GrammarForm from "./GrammarForm";

export default function GrammarPractice({ onBack }) {
    const [items, setItems] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState([]);
    const [finished, setFinished] = useState(false);
    const [waitingNext, setWaitingNext] = useState(false);
    const [editingGrammar, setEditingGrammar] = useState(null);

    const fetchPractice = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getGrammarPractice();
            const rawItems = data.items || [];
            
            const shuffled = [...rawItems];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            
            setItems(shuffled);
        } catch (err) {
            console.error("Failed to load practice:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPractice();
    }, [fetchPractice]);

    const handleAnswer = async (quality) => {
        const item = items[currentIdx];

        try {
            await submitGrammarPractice(item.id, quality);
        } catch (err) {
            console.error("Failed to submit:", err);
        }

        setResults((prev) => [
            ...prev,
            {
                structure: item.structure,
                quality,
                quiz_type: item.quiz_type,
            },
        ]);

        setWaitingNext(true);
    };

    const goNext = () => {
        setWaitingNext(false);
        const next = currentIdx + 1;
        if (next >= items.length) {
            setFinished(true);
        } else {
            setCurrentIdx(next);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Delete this grammar structure?")) return;
        const item = items[currentIdx];
        try {
            await deleteGrammar(item.id);
            setResults((prev) => [
                ...prev,
                { structure: item.structure, quality: 0, quiz_type: item.quiz_type, deleted: true }
            ]);
            goNext();
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    };

    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Enter" && waitingNext && !editingGrammar) {
                goNext();
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    });

    const current = items[currentIdx];
    const progressPct = items.length > 0 ? ((currentIdx + 1) / items.length) * 100 : 0;

    const perfect = results.filter((r) => r.quality === 5 || r.quality === 2).length;
    const partial = results.filter((r) => r.quality === 3 || r.quality === 1).length;
    const failed = results.filter((r) => r.quality === 0).length;

    if (loading) {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto pt-6">
                <div className="glass-card p-12 text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Loading practice session...</p>
                </div>
            </div>
        );
    }

    if (!loading && items.length === 0) {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto pt-6 space-y-4">
                <button onClick={onBack} className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer">
                    ← Back
                </button>
                <div className="glass-card p-12 text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        No grammar due for review!
                    </h3>
                    <p className="text-slate-400 text-sm">
                        Awesome! Check back tomorrow.
                    </p>
                </div>
            </div>
        );
    }

    if (finished) {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto pt-6 space-y-4">
                <div className="glass-card p-6 text-center">
                    <div className="text-5xl mb-4">🏆</div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        Practice Complete!
                    </h2>
                    <p className="text-slate-500 text-sm mb-6">
                        You reviewed {results.length} grammar structure{results.length !== 1 ? "s" : ""} today
                    </p>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <div className="text-2xl font-bold text-emerald-600">{perfect}</div>
                            <div className="text-xs text-emerald-500 mt-1">🎉 Perfect</div>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <div className="text-2xl font-bold text-amber-600">{partial}</div>
                            <div className="text-xs text-amber-500 mt-1">✅ Progressing</div>
                        </div>
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                            <div className="text-2xl font-bold text-rose-600">{failed}</div>
                            <div className="text-xs text-rose-500 mt-1">❌ Missed</div>
                        </div>
                    </div>

                    <div className="space-y-2 text-left mb-6">
                        {results.map((r, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm ${r.quality >= 2
                                    ? "bg-emerald-50/60 text-emerald-700"
                                    : r.quality >= 1
                                        ? "bg-amber-50/60 text-amber-700"
                                        : "bg-rose-50/60 text-rose-700"
                                    }`}
                            >
                                <span className="font-medium">{r.structure}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs opacity-60 capitalize">
                                        {r.quiz_type === "mcq" ? "Multiple Choice" : "Spelling"}
                                    </span>
                                    <span>
                                        {r.quality >= 3 ? "🎉" : (r.quality >= 1 ? "✅" : "❌")}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={onBack}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-500
              text-white hover:from-indigo-600 hover:to-violet-600 transition-all cursor-pointer"
                    >
                        ← Back to Grammar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-2xl mx-auto space-y-4 pt-6">
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer">
                        ← Back
                    </button>
                    <div className="text-sm text-indigo-600 font-medium">🎯 Grammar Practice</div>
                </div>

                <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                        {currentIdx + 1} / {items.length}
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full progress-shimmer rounded-full transition-all duration-500 border"
                            style={{ width: `${progressPct}%`, borderColor: "blue" }}
                        />
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${current?.quiz_type === "mcq"
                        ? "bg-violet-100 text-violet-600"
                        : "bg-teal-100 text-teal-600"
                        }`}>
                        {current?.quiz_type === "mcq" ? "MCQ" : "Spelling"}
                    </span>
                </div>

                {current && (
                    <div key={`${current.id}-${currentIdx}`}>
                        {current.quiz_type === "mcq" ? (
                            <GrammarMCQQuestion
                                item={current}
                                onAnswer={handleAnswer}
                                onEdit={() => setEditingGrammar(current)}
                                onDelete={handleDelete}
                            />
                        ) : (
                            <GrammarSpellingQuestion
                                item={current}
                                onAnswer={handleAnswer}
                                onEdit={() => setEditingGrammar(current)}
                                onDelete={handleDelete}
                            />
                        )}
                    </div>
                )}

                {waitingNext && (
                    <div className="text-center mt-5 animate-fade-in">
                        <button
                            onClick={goNext}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-500
                text-white hover:from-indigo-600 hover:to-violet-600 transition-all cursor-pointer"
                        >
                            {currentIdx + 1 >= items.length ? "See Results" : "Next →"}
                        </button>
                        <div className="text-xs text-slate-400 mt-2">
                            Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">Enter</kbd> to continue
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingGrammar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in relative">
                    <div className="w-full max-w-lg shadow-2xl relative">
                        <GrammarForm
                            grammar={editingGrammar}
                            onClose={() => setEditingGrammar(null)}
                            onSaved={() => {
                                setEditingGrammar(null);
                                // Modifying item in local state so changes reflect slightly,
                                // but a full refetch of practice resets progress.
                                // We'll just close for now to let user proceed fluidly.
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
