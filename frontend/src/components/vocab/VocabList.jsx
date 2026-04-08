import { useState, useEffect } from "react";
import { listVocab, deleteVocab, getVocabPractice } from "../../api";
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

    const [activeCategory, setActiveCategory] = useState(null);
    const [visibleCount, setVisibleCount] = useState(20);
    const today = new Date().toISOString().split("T")[0];

    // Reset visible count when category changes
    useEffect(() => {
        setVisibleCount(20);
    }, [activeCategory]);

    const needsDefinition = vocabItems.filter(v =>
        !v.definitions || v.definitions.length === 0 || !v.definitions.some(d => d.definition.trim())
    );

    const dueForPractice = vocabItems.filter(v =>
        v.definitions && v.definitions.some(d => d.definition.trim()) &&
        v.next_review && v.next_review <= today
    );

    const futureReview = vocabItems.filter(v =>
        v.definitions && v.definitions.some(d => d.definition.trim()) &&
        v.next_review && v.next_review > today
    );

    const categories = [
        {
            id: 'needs-details',
            title: 'Needs Details',
            items: needsDefinition,
            icon: '📝',
            desc: 'New words without definitions',
            classes: {
                border: 'hover:border-amber-400',
                shadow: 'hover:shadow-amber-500/10',
                bg: 'bg-amber-50',
                text: 'text-amber-600'
            }
        },
        {
            id: 'due',
            title: 'Due for Practice',
            items: dueForPractice,
            icon: '🧠',
            desc: 'Ready for SM-2 review',
            classes: {
                border: 'hover:border-violet-400',
                shadow: 'hover:shadow-violet-500/10',
                bg: 'bg-violet-50',
                text: 'text-violet-600'
            }
        },
        {
            id: 'future',
            title: 'Future Review',
            items: futureReview,
            icon: '📅',
            desc: 'Scheduled for later',
            classes: {
                border: 'hover:border-indigo-400',
                shadow: 'hover:shadow-indigo-500/10',
                bg: 'bg-indigo-50',
                text: 'text-indigo-600'
            }
        }
    ];

    const renderItem = (v) => (
        <div
            key={v.id}
            className={`glass-card p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${expandedId === v.id ? 'ring-2 ring-indigo-100' : ''}`}
            onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-indigo-600">{v.word}</span>
                        {v.pronunciation && <span className="text-sm text-slate-400 italic">{v.pronunciation}</span>}
                        {v.audio_url && (
                            <button
                                onClick={(e) => { e.stopPropagation(); new Audio(v.audio_url).play(); }}
                                className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-100 transition-all cursor-pointer text-xs"
                                title="Play audio"
                            >
                                🔊
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {v.next_review && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${v.next_review <= today ? "bg-amber-100 text-amber-600" : "bg-indigo-50 text-indigo-400"}`}>
                                {v.next_review <= today ? "🔥 Due" : `📅 ${v.next_review}`}
                            </span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setEditingVocab(v); }} className="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition-all cursor-pointer text-sm" title="Edit">✎</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }} className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer text-sm" title="Delete">×</button>
                    </div>
                </div>
                {v.general_meaning && <p className="text-sm text-slate-500 font-medium whitespace-pre-wrap line-clamp-3 italic mt-1">{v.general_meaning}</p>}
            </div>
            {expandedId === v.id && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-4 animate-fade-in">
                    {v.definitions && v.definitions.length > 0 ? (
                        v.definitions.map((d, i) => (
                            <div key={d.id || i} className="pl-4 border-l-2 border-indigo-200 relative">
                                <div className="absolute -left-[2px] top-0 bottom-0 w-[2px] bg-indigo-500 rounded-full" />
                                <div className="flex flex-col gap-1.5">
                                    {d.definition && <p className="text-sm text-slate-800 whitespace-pre-wrap"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Meaning:</span>{d.definition}</p>}
                                    {d.example && <p className="text-sm text-slate-500 italic pl-2 border-l border-slate-200 ml-1 whitespace-pre-wrap">"{d.example}"</p>}
                                    {d.patterns && d.patterns.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {d.patterns.map((p, pi) => <span key={pi} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 text-[10px] font-bold border border-indigo-100 uppercase tracking-tighter">{p}</span>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-2">
                            <p className="text-sm text-amber-500 font-medium mb-2">⚠️ No details yet. Click the edit icon to add definitions!</p>
                            <button onClick={(e) => { e.stopPropagation(); setEditingVocab(v); }} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-all">Add Details 📝</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="animate-fade-in max-w-2xl mx-auto pt-6 pb-20 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                    ← Back to Home
                </button>
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
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No vocabulary saved yet</h3>
                    <p className="text-slate-400 text-sm">Practice dictation and click on words to save them</p>
                    <button onClick={() => setIsAdding(true)} className="mt-6 px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-all">Add First Word</button>
                </div>
            ) : !activeCategory ? (
                <div className="space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Vocabulary Dashboard</h2>
                        <p className="text-slate-400 text-sm">Manage and track your learning progress</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`group flex flex-col items-center justify-center p-6 rounded-2xl bg-white border-2 border-slate-100 ${cat.classes.border} ${cat.classes.shadow} transition-all duration-300 text-center relative overflow-hidden cursor-pointer`}
                            >
                                <div className={`absolute top-0 right-0 w-16 h-16 ${cat.classes.bg} rounded-bl-full -mr-6 -mt-6 transition-all group-hover:scale-150 opacity-40`} />
                                <span className="text-4xl mb-3 z-10">{cat.icon}</span>
                                <h3 className="font-bold text-slate-700 mb-1 z-10">{cat.title}</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest z-10 mb-4">{cat.desc}</p>
                                <div className={`px-4 py-1.5 rounded-full ${cat.classes.bg} ${cat.classes.text} font-extrabold text-lg z-10`}>
                                    {cat.items.length}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    {/* Filter navigation */}
                    <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setActiveCategory(null)}
                                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                title="Back to dashboard"
                            >
                                ◀
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{categories.find(c => c.id === activeCategory).icon}</span>
                                <h2 className="text-xl font-extrabold text-slate-800">
                                    {categories.find(c => c.id === activeCategory).title}
                                </h2>
                            </div>
                        </div>
                        <span className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500">
                            {categories.find(c => c.id === activeCategory).items.length} items
                        </span>
                    </div>

                    <div className="space-y-6">
                        {categories.find(c => c.id === activeCategory).items.length === 0 ? (
                            <div className="glass-card p-12 text-center border-dashed">
                                <p className="text-slate-400 italic">No words in this category yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {categories.find(c => c.id === activeCategory).items
                                        .slice(0, visibleCount)
                                        .map(v => renderItem(v))
                                    }
                                </div>
                                {categories.find(c => c.id === activeCategory).items.length > visibleCount && (
                                    <div className="pt-4 text-center">
                                        <button
                                            onClick={() => setVisibleCount(prev => prev + 20)}
                                            className="px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer shadow-sm shadow-slate-200/50"
                                        >
                                            View More (+20) ✨
                                        </button>
                                        <p className="mt-2 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                                            Showing {visibleCount} of {categories.find(c => c.id === activeCategory).items.length}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Edit/Add Modal */}
            {(editingVocab || isAdding) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-lg shadow-2xl relative">
                        <VocabForm
                            vocab={editingVocab}
                            onClose={() => { setEditingVocab(null); setIsAdding(false); }}
                            onSaved={() => { setEditingVocab(null); setIsAdding(false); fetchVocab(); }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
