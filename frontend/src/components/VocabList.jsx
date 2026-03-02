import { useState, useEffect } from "react";
import { listVocab, deleteVocab, getVocabPractice } from "../api";
import VocabForm from "./VocabForm";

export default function VocabList({ onBack, onPractice }) {
    const [vocabItems, setVocabItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [dueCount, setDueCount] = useState(0);
    const [editingVocab, setEditingVocab] = useState(null);
    const [isAdding, setIsAdding] = useState(false);

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
        // Fetch due count
        getVocabPractice()
            .then((data) => setDueCount(data.total || 0))
            .catch(() => { });
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
                <div className="flex items-center gap-3">
                    {dueCount > 0 && (
                        <button
                            onClick={onPractice}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-indigo-500
                text-white hover:from-violet-600 hover:to-indigo-600 transition-all cursor-pointer
                flex items-center gap-2 shadow-md shadow-violet-500/20"
                        >
                            🧠 Practice
                            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                                {dueCount}
                            </span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500
                hover:border-indigo-300 hover:text-indigo-500 transition-all cursor-pointer
                flex items-center justify-center shadow-sm"
                        title="Add word"
                    >
                        +
                    </button>
                    <span className="text-sm text-slate-400">
                        {vocabItems.length} word{vocabItems.length !== 1 ? "s" : ""}
                    </span>
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
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${v.next_review <= new Date().toISOString().split("T")[0]
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-slate-100 text-slate-400"
                                        }`}>
                                        📅 {v.next_review}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingVocab(v);
                                        }}
                                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50
                      flex items-center justify-center transition-all cursor-pointer text-sm"
                                        title="Edit"
                                    >
                                        ✎
                                    </button>
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

            {/* Edit/Add Modal */}
            {(editingVocab || isAdding) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-lg shadow-2xl relative">
                        <VocabForm
                            vocab={editingVocab}
                            onClose={() => {
                                setEditingVocab(null);
                                setIsAdding(false);
                            }}
                            onSaved={() => {
                                setEditingVocab(null);
                                setIsAdding(false);
                                fetchVocab();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
