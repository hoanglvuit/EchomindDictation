import { useState, useEffect } from "react";
import { saveGrammar, updateGrammar } from "../../api";

export default function GrammarForm({ grammar, onClose, onSaved }) {
    const [structure, setStructure] = useState("");
    const [meaning, setMeaning] = useState("");
    const [examples, setExamples] = useState([""]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (grammar) {
            setStructure(grammar.structure || "");
            setMeaning(grammar.meaning || "");
            if (grammar.examples && grammar.examples.length > 0) {
                setExamples(grammar.examples);
            }
        }
    }, [grammar]);

    const updateExample = (index, value) => {
        setExamples(prev => prev.map((ex, i) => (i === index ? value : ex)));
    };

    const addExample = () => setExamples(prev => [...prev, ""]);

    const removeExample = (index) => {
        if (examples.length <= 1) return;
        setExamples(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!structure.trim()) {
            alert("Please enter a grammar structure.");
            return;
        }
        if (!meaning.trim()) {
            alert("Please enter the meaning.");
            return;
        }
        
        const validExamples = examples.map(e => e.trim()).filter(Boolean);
        if (!validExamples.length) {
            alert("Please provide at least one example so you can understand the context.");
            return;
        }

        setSaving(true);
        try {
            if (grammar && grammar.id) {
                await updateGrammar(grammar.id, structure.trim(), meaning.trim(), validExamples);
            } else {
                await saveGrammar(structure.trim(), meaning.trim(), validExamples);
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
                    <div className="text-xs text-slate-400 font-medium mb-1">{grammar ? "Edit Grammar" : "New Grammar Structure"}</div>
                    <input
                        type="text"
                        value={structure}
                        onChange={(e) => setStructure(e.target.value)}
                        placeholder="e.g. go on + Ving"
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
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">Meaning / Usage</label>
                        <textarea
                            value={meaning}
                            onChange={(e) => setMeaning(e.target.value)}
                            placeholder="e.g. Tiếp tục làm gì đó..."
                            rows="2"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                  placeholder:text-slate-300 hover:border-indigo-300 transition-all resize-none"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs text-slate-500 font-medium uppercase tracking-wider">Examples</label>
                        {examples.map((ex, i) => (
                            <div key={i} className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={ex} 
                                    onChange={(e) => updateExample(i, e.target.value)}
                                    placeholder="Natural example sentence..."
                                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700
                                      placeholder:text-slate-300 hover:border-indigo-300 transition-all"
                                />
                                {examples.length > 1 && (
                                    <button onClick={() => removeExample(i)}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                                    >×</button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button onClick={addExample}
                        className="w-full py-2 rounded-lg border border-dashed border-slate-300 text-slate-400 text-xs font-medium uppercase tracking-wide
              hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer"
                    >+ Add another example</button>

                    <button onClick={handleSave} disabled={saving}
                        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
              bg-gradient-to-r from-indigo-500 to-violet-500 text-white
              hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-4"
                    >{saving ? "Saving..." : "💾 Save Grammar"}</button>
                </div>
            )}
        </div>
    );
}
