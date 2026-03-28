import { useState, useRef, useEffect } from "react";

const parseStructure = (structure) => {
    let text = structure;
    text = text.replace(/\s*\/\s*/g, "/");
    text = text.replace(/[^a-zA-Z0-9\s/]/g, " ");
    const chunks = text.trim().split(/\s+/).filter(Boolean);
    
    const groups = [];
    let globalIndex = 0;
    const flatExpected = [];
    
    for (let chunk of chunks) {
        const words = chunk.split('/').filter(Boolean);
        if (words.length === 0) continue;
        
        const groupInputs = [];
        for (let i = 0; i < words.length; i++) {
            groupInputs.push({
                globalIndex: globalIndex,
                expectedWord: words[i]
            });
            flatExpected.push(words[i]);
            globalIndex++;
        }
        groups.push({
            words: words,
            inputs: groupInputs,
            isOrGroup: words.length > 1
        });
    }
    
    return { groups, totalWords: globalIndex, flatExpected };
};

export default function GrammarSpellingQuestion({ item, onAnswer, onEdit, onDelete }) {
    const [parsedData, setParsedData] = useState(null);
    const [userInputs, setUserInputs] = useState([]);
    const [hintIndices, setHintIndices] = useState(new Set());
    const [attempts, setAttempts] = useState(0);
    const [resolved, setResolved] = useState(false);
    
    const inputRefs = useRef([]);

    useEffect(() => {
        const parsed = parseStructure(item.structure);
        
        const numHints = Math.ceil(parsed.totalWords * 0.25);
        const indices = Array.from({length: parsed.totalWords}, (_, i) => i);
        
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const hints = new Set(indices.slice(0, numHints));
        
        const initialInputs = Array(parsed.totalWords).fill("");
        hints.forEach(idx => {
            initialInputs[idx] = parsed.flatExpected[idx];
        });
        
        setParsedData(parsed);
        setUserInputs(initialInputs);
        setHintIndices(hints);
        setAttempts(0);
        setResolved(false);
        
        setTimeout(() => {
            const firstEmpty = Array(parsed.totalWords).fill(0).findIndex((_, i) => !hints.has(i));
            if (firstEmpty !== -1 && inputRefs.current[firstEmpty]) {
                inputRefs.current[firstEmpty].focus();
            }
        }, 100);
    }, [item.structure]);

    const isCorrectAnswer = (currentInputs, parsed) => {
        let globalIdx = 0;
        for (let group of parsed.groups) {
            const expectedParts = [...group.words].map(s => s.toLowerCase()).sort();
            const userParts = currentInputs.slice(globalIdx, globalIdx + group.words.length).map(s => s.trim().toLowerCase()).sort();
            
            for (let i = 0; i < expectedParts.length; i++) {
                if (expectedParts[i] !== userParts[i]) {
                    return false;
                }
            }
            globalIdx += group.words.length;
        }
        return true;
    };

    const handleSubmit = () => {
        if (resolved || userInputs.some(v => !v.trim())) return;

        const isCorrect = isCorrectAnswer(userInputs, parsedData);

        if (isCorrect) {
            setResolved(true);
            const quality = attempts === 0 ? 5 : 3;
            setTimeout(() => onAnswer(quality), 1200);
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);

            if (newAttempts >= 2) {
                setResolved(true);
                setUserInputs(parsedData.flatExpected);
                setTimeout(() => onAnswer(0), 4000);
            } else {
                setUserInputs(prev => prev.map((v, i) => hintIndices.has(i) ? v : ""));
                setTimeout(() => {
                    const firstEmpty = Array(parsedData.totalWords).fill(0).findIndex((_, i) => !hintIndices.has(i));
                    if (firstEmpty !== -1 && inputRefs.current[firstEmpty]) {
                        inputRefs.current[firstEmpty].focus();
                    }
                }, 100);
            }
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === " ") {
            e.preventDefault();
            for (let i = index + 1; i < parsedData.totalWords; i++) {
                if (!hintIndices.has(i)) {
                    if (inputRefs.current[i]) inputRefs.current[i].focus();
                    break;
                }
            }
        } else if (e.key === "Backspace" && !userInputs[index]) {
            for (let i = index - 1; i >= 0; i--) {
                if (!hintIndices.has(i)) {
                    if (inputRefs.current[i]) inputRefs.current[i].focus();
                    break;
                }
            }
        }
    };

    const handleChange = (index, value) => {
        setUserInputs(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    if (!parsedData) return null;

    const allFilled = userInputs.every(v => v.trim().length > 0);

    return (
        <div className="animate-fade-in space-y-5">
            <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-100">
                <div className="text-xs text-teal-400 font-medium mb-1">
                    ✏️ Fill in the correct grammar structure:
                </div>
                <div className="text-base text-slate-700 leading-relaxed font-medium mb-3">
                    <div className="mb-2 p-2 rounded bg-white/50 border border-teal-200 text-sm italic text-teal-700">
                        Meaning: {item.meaning}
                    </div>
                </div>
            </div>

            {/* Input Groups */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 p-5 bg-slate-50/80 rounded-xl border border-slate-200 shadow-inner">
                {parsedData.groups.map((group, gIdx) => (
                    <div key={gIdx} className={`flex items-center ${group.isOrGroup ? 'bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100' : ''}`}>
                        {group.inputs.map((inp, idxInGroup) => {
                            const globalIdx = inp.globalIndex;
                            const isHint = hintIndices.has(globalIdx);
                            const val = userInputs[globalIdx] || "";
                            
                            // Dynamic width based on content length
                            const charLen = Math.max(4, isHint ? parsedData.flatExpected[globalIdx].length : val.length);
                            const widthStyle = { width: `calc(${charLen}ch + 2rem)` };
                            
                            return (
                                <div key={globalIdx} className="flex items-center">
                                    {isHint ? (
                                        <span className="px-3 py-2 text-center font-bold text-lg text-slate-700 select-none">
                                            {parsedData.flatExpected[globalIdx]}
                                        </span>
                                    ) : (
                                        <input
                                            ref={el => inputRefs.current[globalIdx] = el}
                                            type="text"
                                            value={val}
                                            onChange={(e) => handleChange(globalIdx, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, globalIdx)}
                                            disabled={resolved}
                                            style={widthStyle}
                                            className={`px-3 py-2 text-center font-semibold text-lg rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400
                                                ${resolved && attempts === 0
                                                        ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                                                        : resolved
                                                            ? "bg-rose-50 border-rose-400 text-rose-700"
                                                            : "bg-white border-slate-300 text-slate-800 hover:border-teal-300 shadow-sm"
                                                }`}
                                            autoComplete="off"
                                            spellCheck="false"
                                        />
                                    )}
                                    {idxInGroup < group.inputs.length - 1 && (
                                        <span className="mx-2 text-indigo-400 font-bold text-lg select-none">/</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            
            {/* Legend / Helper for OR groups */}
            {parsedData.groups.some(g => g.isOrGroup) && (
                <div className="text-center text-xs text-indigo-500 mt-[-10px]">
                    <span className="inline-block px-3 py-1 bg-indigo-50 rounded border border-indigo-100">
                        Boxes separated by <strong className="text-indigo-600 font-bold text-sm mx-1">/</strong> represent interchangeable meaning. Order doesn't matter!
                    </span>
                </div>
            )}

            {/* Submit button */}
            {!resolved && (
                <div className="flex justify-center mt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={!allFilled}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-500 to-emerald-500
              text-white hover:from-teal-600 hover:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                        ✓ Check Answer
                    </button>
                </div>
            )}

            {/* Result feedback */}
            {resolved && (
                <div
                    className={`p-3 rounded-xl text-sm text-center animate-fade-in mt-4 ${attempts === 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                        : attempts === 1
                            ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-sm"
                            : "bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
                        }`}
                >
                    {attempts === 0 && "🎉 Perfect memory!"}
                    {attempts === 1 && "✅ Correct on second try!"}
                    {attempts >= 2 && (
                        <>
                            ❌ The correct structure is:{" "}
                            <span className="font-bold tracking-wider">
                                {item.structure}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Attempt indicator */}
            {!resolved && attempts === 1 && (
                <div className="text-center text-sm text-amber-600 animate-fade-in font-medium mt-4">
                    ⚠ Incorrect. Please try again!
                </div>
            )}

            {/* Full details after resolution */}
            {resolved && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 animate-fade-in mt-4 shadow-sm relative group">
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                        <button
                            onClick={onEdit}
                            className="w-8 h-8 rounded-lg bg-white/60 text-slate-500 hover:bg-white hover:text-indigo-600 shadow-sm flex items-center justify-center transition-all cursor-pointer"
                            title="Edit"
                        >
                            ✎
                        </button>
                        <button
                            onClick={onDelete}
                            className="w-8 h-8 rounded-lg bg-white/60 text-slate-500 hover:bg-white hover:text-rose-500 shadow-sm flex items-center justify-center transition-all cursor-pointer"
                            title="Delete"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-1 pr-16">
                        <span className="text-lg font-bold text-indigo-700">{item.structure}</span>
                    </div>
                    {item.meaning && (
                        <p className="text-sm text-slate-600 italic mb-3">{item.meaning}</p>
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
