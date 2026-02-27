import { useState } from "react";
import { saveVocab } from "../api";

export default function VocabForm({ word, onClose, onSaved }) {
    const [pronunciation, setPronunciation] = useState("");
    const [definitions, setDefinitions] = useState([{ definition: "", example: "" }]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const updateDef = (index, field, value) => {
        setDefinitions((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
    };

    const addDefinition = () => setDefinitions((prev) => [...prev, { definition: "", example: "" }]);

    const removeDef = (index) => {
        if (definitions.length <= 1) return;
        setDefinitions((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        const validDefs = definitions.filter((d) => d.definition.trim() || d.example.trim());
        if (!validDefs.length && !pronunciation.trim()) {
            alert("Please fill in at least one field.");
            return;
        }
        setSaving(true);
        try {
            await saveVocab(word, pronunciation, validDefs.length ? validDefs : definitions);
            setSaved(true);
            setTimeout(() => onSaved(), 1200);
        } catch (err) {
            alert("Save failed: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass-card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-xs text-slate-400 font-medium">Save Vocabulary</div>
                    <div className="text-xl font-bold text-indigo-600 mt-0.5">{word}</div>
                </div>
                <button onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50
            flex items-center justify-center transition-all cursor-pointer text-lg"
                >×</button>
            </div>

            {saved ? (
                <div className="text-center py-6 animate-fade-in">
                    <div className="text-4xl mb-2">✅</div>
                    <div className="text-emerald-600 font-medium">Saved!</div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Pronunciation</label>
                        <input type="text" value={pronunciation} onChange={(e) => setPronunciation(e.target.value)}
                            placeholder="e.g. /ˈpɛp.ər/"
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                        />
                    </div>

                    {definitions.map((def, i) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">
                                    Definition {definitions.length > 1 ? `#${i + 1}` : ""}
                                </span>
                                {definitions.length > 1 && (
                                    <button onClick={() => removeDef(i)}
                                        className="text-xs text-rose-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    >Remove</button>
                                )}
                            </div>
                            <input type="text" value={def.definition} onChange={(e) => updateDef(i, "definition", e.target.value)}
                                placeholder="Definition..."
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                  placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                            />
                            <input type="text" value={def.example} onChange={(e) => updateDef(i, "example", e.target.value)}
                                placeholder="Example sentence..."
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                  placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                            />
                        </div>
                    ))}

                    <button onClick={addDefinition}
                        className="w-full py-2 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm
              hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer"
                    >+ Add another definition</button>

                    <button onClick={handleSave} disabled={saving}
                        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
              bg-gradient-to-r from-indigo-500 to-violet-500 text-white
              hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >{saving ? "Saving..." : "💾 Save Vocabulary"}</button>
                </div>
            )}
        </div>
    );
}
