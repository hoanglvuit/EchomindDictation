

export default function SegmentHistory({
    allSegments,
    currentIdx,
    segmentsPerBlock = 50
}) {
    const historyBlocks = [];
    for (let i = 0; i < currentIdx; i += segmentsPerBlock) {
        const block = allSegments.slice(i, Math.min(i + segmentsPerBlock, currentIdx));
        const combinedText = block.map(s => s.transcript).join(" ");
        if (combinedText.trim()) historyBlocks.push(combinedText);
    }

    return (
        <>
            {/* Background History - Left Side */}
            <div className="fixed right-[calc(50%+345px)] top-32 bottom-24 w-[550px] hidden lg:block overflow-y-auto scrollbar-hide text-right">
                <div className="flex flex-col gap-16 py-6">
                    {historyBlocks.filter((_, i) => i % 2 === 0).map((text, i) => (
                        <div key={i} className="animate-fade-in group">
                            <div className="text-[11px] leading-relaxed text-slate-700 font-bold opacity-60 hover:opacity-100 transition-opacity p-2">
                                {text}
                            </div>
                            {i < Math.floor((historyBlocks.length - 1) / 2) && (
                                <div className="mt-8 border-b border-slate-200/50 w-32 ml-auto" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Background History - Right Side */}
            <div className="fixed left-[calc(50%+345px)] top-32 bottom-24 w-[550px] hidden lg:block overflow-y-auto scrollbar-hide text-left">
                <div className="flex flex-col gap-16 py-6">
                    {historyBlocks.filter((_, i) => i % 2 !== 0).map((text, i) => (
                        <div key={i} className="animate-fade-in group">
                            <div className="text-[11px] leading-relaxed text-slate-700 font-bold opacity-60 hover:opacity-100 transition-opacity p-2">
                                {text}
                            </div>
                            {i < Math.floor(historyBlocks.length / 2 - 1) && (
                                <div className="mt-8 border-b border-slate-200/50 w-32 mr-auto" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Mobile/Small Screen History - Horizontal scroll */}
            <div className="lg:hidden max-w-2xl mx-auto mb-6 px-4 pt-4">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Recent Context</div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {allSegments.slice(0, currentIdx).reverse().map((seg, i) => (
                        <div key={i} className="flex-shrink-0 max-w-[200px] text-[10px] text-slate-700 font-bold bg-white/50 backdrop-blur-md p-2 rounded-xl border border-white/30 italic">
                            {seg.transcript}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
