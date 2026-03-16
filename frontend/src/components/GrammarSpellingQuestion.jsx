import { useState, useRef, useEffect } from "react";

export default function GrammarSpellingQuestion({ item, onAnswer }) {
    const [userInput, setUserInput] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [resolved, setResolved] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const getExpectedTokens = (structure) => {
        let text = structure.toLowerCase();
        text = text.replace(/\s*\/\s*/g, "/");
        text = text.replace(/[^a-z0-9\s/]/g, " ");
        return text.trim().split(/\s+/).filter(Boolean);
    };

    const isCorrectAnswer = (input, structure) => {
        const expectedTokens = getExpectedTokens(structure);
        let userText = input.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
        let userTokens = userText.trim().split(/\s+/).filter(Boolean);
        
        let expectedWordCount = 0;
        for(let t of expectedTokens) {
            expectedWordCount += t.split('/').length;
        }
        
        if (userTokens.length !== expectedWordCount) return false;
        
        let userIdx = 0;
        for (let expectedToken of expectedTokens) {
            let parts = expectedToken.split('/');
            let userParts = userTokens.slice(userIdx, userIdx + parts.length).map(p => p.toLowerCase());
            let expectedParts = parts.map(p => p.toLowerCase());
            
            userParts.sort();
            expectedParts.sort();
            
            for (let i = 0; i < parts.length; i++) {
                if (userParts[i] !== expectedParts[i]) {
                    return false;
                }
            }
            
            userIdx += parts.length;
        }
        
        return true;
    };

    const handleSubmit = () => {
        if (!userInput.trim() || resolved) return;

        const isCorrect = isCorrectAnswer(userInput, item.structure);

        if (isCorrect) {
            setResolved(true);
            const quality = attempts === 0 ? 5 : 3;
            setTimeout(() => onAnswer(quality), 1200);
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);

            if (newAttempts >= 2) {
                setResolved(true);
                setTimeout(() => onAnswer(0), 4000);
            } else {
                setUserInput("");
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="animate-fade-in space-y-5">
            {/* Question */}
            <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-100">
                <div className="text-xs text-teal-400 font-medium mb-1">
                    ✏️ Fill in the correct grammar structure:
                </div>
                <div className="text-base text-slate-700 leading-relaxed font-medium mb-3">
                    <div className="mb-2 p-2 rounded bg-white/50 border border-teal-200 text-sm italic text-teal-700">
                        Meaning: {item.meaning}
                    </div>
                </div>
                {/* Hint Display */}
                <div className="text-center p-3 bg-white rounded border border-teal-200 shadow-sm">
                    <span className="font-mono text-lg font-bold tracking-widest text-teal-600">
                        {item.hint}
                    </span>
                </div>
            </div>

            {/* Input */}
            <div>
                <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={resolved}
                    placeholder="Type the EXACT structure..."
                    className={`w-full px-4 py-3 rounded-xl bg-white border text-sm transition-all duration-200
            ${resolved && attempts === 0
                            ? "border-emerald-400 text-emerald-700"
                            : resolved
                                ? "border-rose-400 text-rose-700"
                                : "border-slate-200 text-slate-700 hover:border-indigo-300"
                        }
            placeholder:text-slate-300 disabled:opacity-60 text-center text-lg font-semibold tracking-wide`}
                    autoComplete="off"
                    spellCheck="false"
                />
            </div>

            {/* Submit button */}
            {!resolved && (
                <div className="flex justify-center">
                    <button
                        onClick={handleSubmit}
                        disabled={!userInput.trim()}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-500 to-emerald-500
              text-white hover:from-teal-600 hover:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all cursor-pointer"
                    >
                        ✓ Check Structure
                    </button>
                </div>
            )}

            {/* Result feedback */}
            {resolved && (
                <div
                    className={`p-3 rounded-xl text-sm text-center animate-fade-in ${attempts === 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : attempts === 1
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
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
                <div className="text-center text-xs text-amber-500 animate-fade-in">
                    ⚠ Incorrect. Please try again!
                </div>
            )}

            {/* Full details after resolution */}
            {resolved && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 animate-fade-in">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-bold text-indigo-600">{item.structure}</span>
                    </div>
                    {item.meaning && (
                        <p className="text-sm text-slate-500 italic mb-3">{item.meaning}</p>
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
