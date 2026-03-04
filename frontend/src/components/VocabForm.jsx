import { useState, useEffect, useCallback } from "react";
import { saveVocab, updateVocab, scrapeVocab } from "../api";

export default function VocabForm({ word: initialWord, vocab, onClose, onSaved }) {
    const [word, setWord] = useState(typeof initialWord === "string" ? initialWord : "");
    const [pronunciation, setPronunciation] = useState("");
    const [generalMeaning, setGeneralMeaning] = useState("");
    const [audioUrl, setAudioUrl] = useState("");
    const [oxfordUrl, setOxfordUrl] = useState("");
    const [definitions, setDefinitions] = useState([{ definition: "", example: "", patterns: [] }]);
    const [saving, setSaving] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (vocab) {
            setWord(vocab.word || "");
            setPronunciation(vocab.pronunciation || "");
            setGeneralMeaning(vocab.general_meaning || "");
            setAudioUrl(vocab.audio_url || "");
            if (vocab.definitions && vocab.definitions.length > 0) {
                setDefinitions(vocab.definitions.map(d => ({
                    definition: d.definition || "",
                    example: d.example || "",
                    patterns: d.patterns || []
                })));
            }
        }
    }, [vocab]);

    const updateDef = (index, field, value) => {
        setDefinitions((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
    };

    const addPattern = (defIndex, pattern) => {
        if (!pattern.trim()) return;
        setDefinitions(prev => prev.map((d, i) =>
            i === defIndex ? { ...d, patterns: [...(d.patterns || []), pattern.trim()] } : d
        ));
    };

    const removePattern = (defIndex, pIndex) => {
        setDefinitions(prev => prev.map((d, i) =>
            i === defIndex ? { ...d, patterns: d.patterns.filter((_, pi) => pi !== pIndex) } : d
        ));
    };

    const addDefinition = () => setDefinitions((prev) => [...prev, { definition: "", example: "", patterns: [] }]);

    const removeDef = (index) => {
        if (definitions.length <= 1) return;
        setDefinitions((prev) => prev.filter((_, i) => i !== index));
    };

    const handleFetchOxford = useCallback(async (urlToFetch) => {
        const url = urlToFetch || oxfordUrl;
        if (!url || !url.includes("oxfordlearnersdictionaries.com")) return;

        setFetching(true);
        try {
            const data = await scrapeVocab(url);
            if (data.phonetic) setPronunciation(data.phonetic);
            if (data.audio_url) setAudioUrl(data.audio_url);
        } catch (err) {
            console.error("Failed to fetch from Oxford:", err);
        } finally {
            setFetching(false);
        }
    }, [oxfordUrl]);

    // Auto-fetch if user pastes an Oxford URL
    useEffect(() => {
        if (oxfordUrl.includes("oxfordlearnersdictionaries.com") && oxfordUrl !== (vocab?.oxford_url || "")) {
            const timer = setTimeout(() => handleFetchOxford(), 1000);
            return () => clearTimeout(timer);
        }
    }, [oxfordUrl, handleFetchOxford, vocab]);

    const handleSave = async () => {
        if (!word.trim()) {
            alert("Please enter a word.");
            return;
        }
        const validDefs = definitions.filter((d) => d.definition.trim() || d.example.trim() || (d.patterns && d.patterns.length > 0));
        if (!validDefs.length && !pronunciation.trim() && !generalMeaning.trim()) {
            alert("Please fill in at least one field.");
            return;
        }
        setSaving(true);
        try {
            if (vocab && vocab.id) {
                await updateVocab(vocab.id, word.trim(), pronunciation, validDefs.length ? validDefs : definitions, generalMeaning.trim(), audioUrl);
            } else {
                await saveVocab(word.trim(), pronunciation, validDefs.length ? validDefs : definitions, generalMeaning.trim(), audioUrl);
            }
            setSaved(true);
            setTimeout(() => onSaved(), 800);
        } catch (err) {
            alert("Save failed: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass-card p-5 animate-slide-up max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                    <div className="text-xs text-slate-400 font-medium mb-1">Save Vocabulary</div>
                    <input
                        type="text"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        className="text-xl font-bold text-indigo-600 bg-transparent border-b-2 border-dashed border-indigo-200
              hover:border-indigo-400 focus:border-indigo-500 transition-all outline-none w-full py-0.5"
                        spellCheck="false"
                    />
                </div>
                <button onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50
            flex items-center justify-center transition-all cursor-pointer text-lg ml-3"
                >×</button>
            </div>

            {saved ? (
                <div className="text-center py-6 animate-fade-in">
                    <div className="text-4xl mb-2">✅</div>
                    <div className="text-emerald-600 font-medium">Saved!</div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="mb-4">
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Oxford Dictionary URL (for auto-fill)</label>
                        <div className="flex gap-2">
                            <input type="text" value={oxfordUrl} onChange={(e) => setOxfordUrl(e.target.value)}
                                placeholder="Paste Oxford URL here..."
                                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                    placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                            />
                            <button
                                onClick={() => handleFetchOxford()}
                                disabled={fetching || !oxfordUrl.includes("oxfordlearnersdictionaries.com")}
                                className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold
                    hover:bg-indigo-100 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                            >
                                {fetching ? "..." : "Fetch"}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">General Meaning (Core Idea)</label>
                        <textarea
                            value={generalMeaning}
                            onChange={(e) => setGeneralMeaning(e.target.value)}
                            placeholder="A simple, clear core idea of the word..."
                            rows="2"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                  placeholder:text-slate-300 hover:border-indigo-300 transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1 font-medium">Pronunciation</label>
                            <input type="text" value={pronunciation} onChange={(e) => setPronunciation(e.target.value)}
                                placeholder="e.g. /ˈpɛp.ər/"
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                    placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1 font-medium">Audio URL</label>
                            <div className="flex gap-2">
                                <input type="text" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
                                    placeholder="MP3 link..."
                                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                      placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                                />
                                {audioUrl && (
                                    <button
                                        onClick={() => new Audio(audioUrl).play()}
                                        className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center
                        hover:bg-indigo-100 transition-all cursor-pointer"
                                        title="Test audio"
                                    >
                                        🔊
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs text-slate-500 font-medium uppercase tracking-wider">Usage Categories</label>
                        {definitions.map((def, i) => (
                            <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 relative">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                                        Category {i + 1}
                                    </span>
                                    {definitions.length > 1 && (
                                        <button onClick={() => removeDef(i)}
                                            className="text-xs text-rose-400 hover:text-rose-500 transition-colors cursor-pointer"
                                        >Remove</button>
                                    )}
                                </div>

                                <div>
                                    <input type="text" value={def.definition} onChange={(e) => updateDef(i, "definition", e.target.value)}
                                        placeholder="Common definition..."
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                          placeholder:text-slate-300 hover:border-indigo-300 transition-all mb-2"
                                    />
                                    <input type="text" value={def.example} onChange={(e) => updateDef(i, "example", e.target.value)}
                                        placeholder="Natural example sentence..."
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                          placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                                    />
                                </div>

                                <div className="pt-1">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 ml-1">Highlighted Patterns</div>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {(def.patterns || []).map((p, pi) => (
                                            <span key={pi} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-medium border border-indigo-100">
                                                {p}
                                                <button onClick={() => removePattern(i, pi)} className="hover:text-rose-500 cursor-pointer text-xs">×</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="e.g. get + adjective"
                                            className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 placeholder:text-slate-300 outline-none focus:border-indigo-300"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addPattern(i, e.target.value);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                const input = e.currentTarget.previousSibling;
                                                addPattern(i, input.value);
                                                input.value = '';
                                            }}
                                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-300 transition-all"
                                        >ADD</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button onClick={addDefinition}
                        className="w-full py-2 rounded-lg border border-dashed border-slate-300 text-slate-400 text-xs font-medium uppercase tracking-wide
              hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer"
                    >+ Add another category</button>

                    <button onClick={handleSave} disabled={saving}
                        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
              bg-gradient-to-r from-indigo-500 to-violet-500 text-white
              hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-2"
                    >{saving ? "Saving..." : "💾 Save Vocabulary"}</button>
                </div>
            )}
        </div>
    );
}
