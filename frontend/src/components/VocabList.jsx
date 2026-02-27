import { useState, useEffect } from "react";
import { listVocab, deleteVocab } from "../api";

export default function VocabList({ onBack }) {
    const [vocabItems, setVocabItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    const fetchVocab = async () => {
        try {
            const data = await listVocab();
            setVocabItems(data.vocab || []);
        } catch (err) {
            console.error("Failed to load vocab:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVocab();
    }, []);

    const handleDelete = async (id) => {
        if (!confirm("Delete this vocabulary?")) return;
        try {
            await deleteVocab(id);
            setVocabItems((prev) => prev.filter((v) => v.id !== id));
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    };

    return (
        <div className="animate-fade-in max-w-2xl mx-auto pt-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                    ← Back to Home
                </button>
                <h2 className="text-xl font-bold text-slate-800">📖 My Vocabulary</h2>
                <div className="text-sm text-slate-400">
                    {vocabItems.length} word{vocabItems.length !== 1 ? "s" : ""}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-16">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Loading vocabulary...</p>
                </div>
            ) : vocabItems.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <div className="text-5xl mb-4">📚</div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        No vocabulary saved yet
                    </h3>
                    <p className="text-slate-400 text-sm">
                        Practice dictation and click on words in the answer to save them
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {vocabItems.map((v) => (
                        <div
                            key={v.id}
                            className="glass-card p-4 cursor-pointer transition-all duration-200"
                            onClick={() =>
                                setExpandedId(expandedId === v.id ? null : v.id)
                            }
                        >
                            {/* Word header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-indigo-600">
                                        {v.word}
                                    </span>
                                    {v.pronunciation && (
                                        <span className="text-sm text-slate-400 italic">
                                            {v.pronunciation}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">
                                        {v.created_at?.split("T")[0]}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(v.id);
                                        }}
                                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-50
                      flex items-center justify-center transition-all cursor-pointer text-sm"
                                        title="Delete"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            {/* Expanded definitions */}
                            {expandedId === v.id && v.definitions && (
                                <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2 animate-fade-in">
                                    {v.definitions.map((d, i) => (
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
                                    {(!v.definitions || v.definitions.length === 0) && (
                                        <p className="text-sm text-slate-400 italic">
                                            No definitions added
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
