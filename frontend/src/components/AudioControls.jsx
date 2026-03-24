

export default function AudioControls({
    isPlaying,
    onTogglePlay,
    currentTime,
    duration,
    onSeek,
    playbackRate,
    onSpeedChange,
}) {
    const formatSeconds = (secs) => {
        if (isNaN(secs)) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    return (
        <div className="audio-controls-container">
            {/* Audio Controls */}
            <div className="flex justify-center items-center gap-4 mb-5">
                {!isPlaying ? (
                    <button
                        onClick={onTogglePlay}
                        className="relative px-8 py-2.5 rounded-xl font-semibold text-sm bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-all duration-200 cursor-pointer flex items-center gap-2"
                    >
                        <span>▶</span> Play
                    </button>
                ) : (
                    <button
                        onClick={onTogglePlay}
                        className="relative px-8 py-2.5 rounded-xl font-semibold text-sm bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all duration-200 cursor-pointer flex items-center gap-2"
                    >
                        <span>⏸</span> Pause
                    </button>
                )}

                <span className="text-xs text-slate-400 self-center">
                    or press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-xs border border-slate-200">Ctrl</kbd> to restart
                </span>
            </div>

            {/* Seekbar */}
            <div className="mb-5 space-y-1">
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        step="0.01"
                        value={currentTime}
                        onChange={onSeek}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>{formatSeconds(currentTime)}</span>
                    <span>{formatSeconds(duration)}</span>
                </div>
            </div>

            {/* Speed Controls */}
            <div className="flex items-center justify-center gap-2 mb-6 p-2 rounded-xl bg-slate-50/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Speed:</span>
                {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
                    <button
                        key={rate}
                        onClick={() => onSpeedChange(rate)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all
        ${playbackRate === rate
                                ? "bg-white text-indigo-600 shadow-sm border border-indigo-100 scale-110"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            }`}
                    >
                        {rate}x
                    </button>
                ))}
            </div>
        </div>
    );
}
