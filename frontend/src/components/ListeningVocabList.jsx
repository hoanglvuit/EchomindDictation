import { useState, useEffect, useCallback } from "react";
import { listListeningVocab, deleteListeningVocab, saveListeningVocab, scrapeListeningVocab } from "../api";

export default function ListeningVocabList({ onBack, onPractice }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const data = await listListeningVocab();
            setItems(data.items || []);
        } catch (err) {
            console.error("Failed to load listening vocab:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const handleDelete = async (id) => {
        if (!confirm("Delete this listening vocab?")) return;
        try {
            await deleteListeningVocab(id);
            setItems((prev) => prev.filter((v) => v.id !== id));
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    };

    const dueCount = items.filter((v) => {
        if (!v.next_review) return false;
        return v.next_review <= new Date().toISOString().split("T")[0];
    }).length;

    return (
        <div className="animate-fade-in max-w-2xl mx-auto space-y-4 pt-6">
            {/* Header */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer">
                        ← Back
                    </button>
                    <div className="text-sm text-orange-600 font-medium">🎧 Listening Vocab</div>
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 flex items-center gap-4">
                        <span className="text-xs text-slate-400">
                            Total: <span className="font-bold text-slate-600">{items.length}</span>
                        </span>
                        {dueCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold">
                                {dueCount} due for review
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAdd(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600
                                hover:bg-orange-100 transition-all cursor-pointer"
                        >
                            + Add
                        </button>
                        <button
                            onClick={onPractice}
                            disabled={dueCount === 0}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-500
                                text-white hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed
                                transition-all cursor-pointer"
                        >
                            🎯 Practice ({dueCount})
                        </button>
                    </div>
                </div>

                {/* Items list */}
                {loading ? (
                    <div className="text-center py-8">
                        <div className="spinner mx-auto mb-2" />
                        <p className="text-slate-400 text-sm">Loading...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">🎧</div>
                        <p className="text-slate-400 text-sm">No listening vocab yet.</p>
                        <p className="text-slate-300 text-xs mt-1">Quick-save words from dictation or add them manually.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((v) => (
                            <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50/60 hover:bg-orange-100/80 transition-all duration-200">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="text-sm font-semibold text-slate-700">{v.word}</span>
                                    {v.audio_url && (
                                        <button
                                            onClick={() => new Audio(v.audio_url).play()}
                                            className="w-7 h-7 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center
                                                hover:bg-orange-200 transition-all cursor-pointer text-xs flex-shrink-0"
                                            title="Play audio"
                                        >
                                            🔊
                                        </button>
                                    )}
                                    {!v.audio_url && (
                                        <span className="text-[10px] text-rose-400 bg-rose-50 px-1.5 py-0.5 rounded">No audio</span>
                                    )}
                                    {v.next_review && (
                                        <span className="text-[10px] text-slate-400">
                                            Review: {v.next_review}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(v.id)}
                                    className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 hover:text-rose-500 transition-all cursor-pointer text-sm"
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAdd && (
                <AddListeningVocabModal
                    onClose={() => setShowAdd(false)}
                    onSaved={() => { setShowAdd(false); fetchItems(); }}
                />
            )}
        </div>
    );
}


function AddListeningVocabModal({ onClose, onSaved }) {
    const [word, setWord] = useState("");
    const [oxfordUrl, setOxfordUrl] = useState("");
    const [audioUrl, setAudioUrl] = useState("");
    const [fetching, setFetching] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleFetch = async () => {
        const url = oxfordUrl || `https://www.oxfordlearnersdictionaries.com/definition/english/${word.toLowerCase()}`;
        if (!url) return;
        setFetching(true);
        try {
            const data = await scrapeListeningVocab(url);
            if (data.audio_url) setAudioUrl(data.audio_url);
        } catch (err) {
            console.error("Failed to scrape:", err);
        } finally {
            setFetching(false);
        }
    };

    const handleSave = async () => {
        if (!word.trim()) { alert("Please enter a word."); return; }
        setSaving(true);
        try {
            await saveListeningVocab(word.trim(), audioUrl || null);
            onSaved();
        } catch (err) {
            alert("Save failed: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md glass-card p-5 shadow-2xl animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-orange-600">🎧 Add Listening Vocab</div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50
                            flex items-center justify-center transition-all cursor-pointer text-lg"
                    >×</button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Word</label>
                        <input type="text" value={word} onChange={(e) => setWord(e.target.value)}
                            placeholder="e.g. accommodate"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                                placeholder:text-slate-300 hover:border-orange-300 transition-all"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Oxford URL (optional)</label>
                        <div className="flex gap-2">
                            <input type="text" value={oxfordUrl} onChange={(e) => setOxfordUrl(e.target.value)}
                                placeholder="Auto-generates from word if empty..."
                                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                                    placeholder:text-slate-300 hover:border-orange-300 transition-all"
                            />
                            <button onClick={handleFetch} disabled={fetching || !word.trim()}
                                className="px-3 py-2 rounded-lg bg-orange-50 text-orange-600 text-xs font-semibold
                                    hover:bg-orange-100 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                            >
                                {fetching ? "..." : "Fetch Audio"}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Audio URL</label>
                        <div className="flex gap-2">
                            <input type="text" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
                                placeholder="MP3 link..."
                                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                                    placeholder:text-slate-300 hover:border-orange-300 transition-all"
                            />
                            {audioUrl && (
                                <button onClick={() => new Audio(audioUrl).play()}
                                    className="w-10 h-10 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center
                                        hover:bg-orange-100 transition-all cursor-pointer"
                                    title="Test audio"
                                >🔊</button>
                            )}
                        </div>
                    </div>

                    <button onClick={handleSave} disabled={saving || !word.trim()}
                        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
                            bg-gradient-to-r from-orange-500 to-amber-500 text-white
                            hover:from-orange-600 hover:to-amber-600 hover:shadow-lg hover:shadow-orange-500/25
                            disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-1"
                    >
                        {saving ? "Saving..." : "💾 Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
