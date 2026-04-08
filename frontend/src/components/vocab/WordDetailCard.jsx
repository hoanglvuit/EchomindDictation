/**
 * WordDetailCard — shows word info after quiz resolution.
 * Shared between MCQQuestion and SpellingQuestion.
 */
export default function WordDetailCard({ item, onEdit, onDelete }) {
    return (
        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 animate-fade-in">
            <div className="flex items-center gap-3 mb-1">
                <span className="text-lg font-bold text-indigo-600">{item.word}</span>
                {item.audio_url && (
                    <button
                        onClick={() => new Audio(item.audio_url).play()}
                        className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center
                    hover:bg-indigo-200 transition-all cursor-pointer text-xs"
                        title="Play audio"
                    >
                        🔊
                    </button>
                )}
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-100 flex items-center justify-center transition-all cursor-pointer text-sm"
                        title="Edit"
                    >
                        ✎
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-all cursor-pointer text-sm"
                        title="Delete"
                    >
                        🗑️
                    </button>
                )}
                {item.pronunciation && (
                    <span className="text-sm text-slate-400 italic">{item.pronunciation}</span>
                )}
            </div>
            {item.general_meaning && (
                <p className="text-sm text-slate-500 italic mb-3 whitespace-pre-wrap">{item.general_meaning}</p>
            )}
            {item.definitions && item.definitions.length > 0 && (
                <div className="space-y-2">
                    {item.definitions.map((d, i) => (
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
                            {d.patterns && d.patterns.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {d.patterns.map((p, pi) => (
                                        <span key={pi} className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 text-[10px] font-bold uppercase tracking-tighter">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
