export default function CompletionPage({ stats, onRestart }) {
    const total = stats.correct + stats.incorrect + stats.skipped;
    const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

    return (
        <div className="animate-fade-in max-w-md mx-auto pt-16">
            <div className="glass-card p-8 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    Session Complete!
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                    You scored {pct}% accuracy
                </p>

                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="text-2xl font-bold text-emerald-600">{stats.correct}</div>
                        <div className="text-xs text-emerald-500 mt-1">Correct</div>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-2xl font-bold text-rose-500">{stats.incorrect}</div>
                        <div className="text-xs text-rose-400 mt-1">Incorrect</div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="text-2xl font-bold text-amber-500">{stats.skipped}</div>
                        <div className="text-xs text-amber-400 mt-1">Skipped</div>
                    </div>
                </div>

                <button
                    onClick={onRestart}
                    className="px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200
            bg-gradient-to-r from-indigo-500 to-violet-500 text-white
            hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25
            cursor-pointer"
                >
                    ↻ Back to Home
                </button>
            </div>
        </div>
    );
}
