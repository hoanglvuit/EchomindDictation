import { useState, useEffect } from "react";
import { listGrammar, deleteGrammar, getGrammarPractice } from "../api";
import GrammarForm from "./GrammarForm";

export default function GrammarList({ onBack, onPractice }) {
    const [grammarItems, setGrammarItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [dueCount, setDueCount] = useState(0);
    const [editingGrammar, setEditingGrammar] = useState(null);
    const [isAdding, setIsAdding] = useState(false);

    const fetchGrammar = async () => {
        try {
            const data = await listGrammar();
            setGrammarItems(data.grammar || []);
        } catch (err) {
            console.error("Failed to load grammar:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGrammar();
        // Fetch due count
        getGrammarPractice()
            .then((data) => setDueCount(data.total || 0))
            .catch(() => { });
    }, []);

    const handleDelete = async (id) => {
        if (!confirm("Delete this grammar structure?")) return;
        try {
            await deleteGrammar(id);
            setGrammarItems((prev) => prev.filter((g) => g.id !== id));
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

    const dueForPractice = grammarItems.filter(g => g.next_review && g.next_review <= today);
    const futureReview = grammarItems.filter(g => g.next_review && g.next_review > today);

    const categories = [
        {
            id: 'due',
            title: 'Due for Practice',
            items: dueForPractice,
            icon: '🎯',
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
                border: 'hover:border-blue-400',
                shadow: 'hover:shadow-blue-500/10',
                bg: 'bg-blue-50',
                text: 'text-blue-600'
            }
        }
    ];

    const renderItem = (g) => (
        <div
            key={g.id}
            className={`glass-card p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${expandedId === g.id ? 'ring-2 ring-indigo-100' : ''}`}
            onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-indigo-600">{g.structure}</span>
                    <div className="flex items-center gap-2">
                        {g.next_review && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${g.next_review <= today ? "bg-amber-100 text-amber-600" : "bg-indigo-50 text-indigo-400"}`}>
                                {g.next_review <= today ? "🔥 Due" : `📅 ${g.next_review}`}
                            </span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setEditingGrammar(g); }} className="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition-all cursor-pointer text-sm" title="Edit">✎</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }} className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer text-sm" title="Delete">×</button>
                    </div>
                </div>
                <p className="text-sm text-slate-500 font-medium whitespace-pre-wrap line-clamp-3 italic mt-1">{g.meaning}</p>
            </div>
            {expandedId === g.id && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-3 animate-fade-in pl-2 border-l-2 border-indigo-200 ml-1">
                    {g.examples && g.examples.length > 0 ? (
                        g.examples.map((ex, i) => (
                            <p key={i} className="text-sm text-slate-700">📌 "{ex}"</p>
                        ))
                    ) : (
                        <p className="text-sm text-amber-500 italic">No examples found.</p>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="animate-fade-in max-w-2xl mx-auto pt-6 pb-20 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer">
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
                            🎯 Practice
                            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                                {dueCount}
                            </span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-500 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                        title="Add grammar"
                    >
                        +
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-16">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Loading grammar...</p>
                </div>
            ) : grammarItems.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <div className="text-5xl mb-4">🧩</div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Grammar saved yet</h3>
                    <p className="text-slate-400 text-sm">Create flashcards for grammar structures, phrasal verbs, or idioms.</p>
                    <button onClick={() => setIsAdding(true)} className="mt-6 px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-all">Add Structure</button>
                </div>
            ) : !activeCategory ? (
                <div className="space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Grammar Dashboard</h2>
                        <p className="text-slate-400 text-sm">Manage grammar flashcards</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg mx-auto">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`group flex flex-col items-center justify-center p-6 rounded-2xl bg-white border-2 border-slate-100 ${cat.classes.border} ${cat.classes.shadow} transition-all duration-300 text-center relative overflow-hidden cursor-pointer`}
                            >
                                <div className={`absolute top-0 right-0 w-16 h-16 ${cat.classes.bg} rounded-bl-full -mr-6 -mt-6 transition-all group-hover:scale-150 opacity-40`} />
                                <span className="text-4xl mb-3 z-10">{cat.icon}</span>
                                <h3 className="font-bold text-slate-700 mb-1 z-10">{cat.title}</h3>
                                <div className={`px-4 py-1.5 rounded-full ${cat.classes.bg} ${cat.classes.text} font-extrabold text-lg z-10`}>
                                    {cat.items.length}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setActiveCategory(null)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all">◀</button>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{categories.find(c => c.id === activeCategory).icon}</span>
                                <h2 className="text-xl font-extrabold text-slate-800">{categories.find(c => c.id === activeCategory).title}</h2>
                            </div>
                        </div>
                        <span className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500">
                            {categories.find(c => c.id === activeCategory).items.length} items
                        </span>
                    </div>

                    <div className="space-y-6">
                        {categories.find(c => c.id === activeCategory).items.length === 0 ? (
                            <div className="glass-card p-12 text-center border-dashed">
                                <p className="text-slate-400 italic">No grammar in this category.</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {categories.find(c => c.id === activeCategory).items
                                        .slice(0, visibleCount)
                                        .map(g => renderItem(g))
                                    }
                                </div>
                                {categories.find(c => c.id === activeCategory).items.length > visibleCount && (
                                    <div className="pt-4 text-center">
                                        <button onClick={() => setVisibleCount(prev => prev + 20)} className="px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer shadow-sm shadow-slate-200/50">View More (+20) ✨</button>
                                        <p className="mt-2 text-[10px] text-slate-400 uppercase font-bold tracking-widest">Showing {visibleCount} of {categories.find(c => c.id === activeCategory).items.length}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Edit/Add Modal */}
            {(editingGrammar || isAdding) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-lg shadow-2xl relative">
                        <GrammarForm
                            grammar={editingGrammar}
                            onClose={() => { setEditingGrammar(null); setIsAdding(false); }}
                            onSaved={() => { setEditingGrammar(null); setIsAdding(false); fetchGrammar(); }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
