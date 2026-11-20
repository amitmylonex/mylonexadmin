"use client";

interface ExcelImportToolbarProps {
    totalRows: number;
    readyCount: number;
    issuesCount: number;
    editedCount: number;
    activeFilter: "all" | "ready" | "issues";
    onFilterChange: (_filter: "all" | "ready" | "issues") => void;
    searchQuery: string;
    onSearchChange: (_query: string) => void;
    onAddRowClick: () => void;
    onBackToMapping: () => void;
    onContinueToPreview: () => void;
    canContinue: boolean;
}

export default function ExcelImportToolbar({
    totalRows,
    readyCount,
    issuesCount,
    editedCount,
    activeFilter,
    onFilterChange,
    searchQuery,
    onSearchChange,
    onAddRowClick,
    onBackToMapping,
    onContinueToPreview,
    canContinue,
}: ExcelImportToolbarProps) {
    return (
        <div className="catalog-review-toolbar space-y-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/90">
            {/* Top Toolbar Row */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                {/* Left: Title & Quick Summary */}
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                Fabric Catalog Data
                            </h3>
                            <span className="rounded-full bg-slate-200/80 px-2 py-0.2 text-[10px] font-bold text-slate-700">
                                {totalRows}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {totalRows} fabric{totalRows === 1 ? "" : "s"} •{" "}
                            <span className="text-emerald-700 font-semibold">{readyCount} ready</span> •{" "}
                            <span className={issuesCount > 0 ? "text-amber-700 font-semibold" : ""}>
                                {issuesCount} need review
                            </span>
                            {editedCount > 0 && (
                                <span className="text-blue-600 font-semibold"> • {editedCount} edited</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Center / Right: Search, Filter Tabs & Compact Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative min-w-[180px] max-w-[240px]">
                        <svg
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search fabrics..."
                            aria-label="Search fabrics"
                            className="w-full h-8 pl-8 pr-7 text-xs bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => onSearchChange("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold"
                                aria-label="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Pills */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => onFilterChange("all")}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                                activeFilter === "all"
                                    ? "bg-slate-900 text-white shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterChange("ready")}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                                activeFilter === "ready"
                                    ? "bg-emerald-600 text-white shadow-2xs"
                                    : "text-emerald-700 hover:text-emerald-900"
                            }`}
                        >
                            <span>✓</span> Ready
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterChange("issues")}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                                activeFilter === "issues"
                                    ? "bg-amber-600 text-white shadow-2xs"
                                    : "text-amber-800 hover:text-amber-950"
                            }`}
                        >
                            <span>⚠</span> Review
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 ml-auto xl:ml-0">
                        <button
                            type="button"
                            onClick={onAddRowClick}
                            className="inline-flex items-center gap-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                            title="Add a new blank fabric row"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>+ Row</span>
                        </button>

                        <button
                            type="button"
                            onClick={onBackToMapping}
                            className="inline-flex items-center gap-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            title="Return to column mapping configuration"
                        >
                            <span>← Mapping</span>
                        </button>

                        <button
                            type="button"
                            onClick={onContinueToPreview}
                            disabled={!canContinue}
                            className={`inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-xs font-bold transition-all shadow-xs ${
                                canContinue
                                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                            <span>Buyer Preview</span>
                            <span>→</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Validation Notice Banner (if issues exist) */}
            {issuesCount > 0 && activeFilter !== "issues" && (
                <div className="flex items-center justify-between text-xs text-amber-900 bg-amber-50/90 border border-amber-200 rounded-lg px-3 py-1.5 font-medium">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-600 font-bold">⚠</span>
                        <span>
                            <strong>{issuesCount} fabric{issuesCount > 1 ? "s" : ""}</strong> require attention. Click highlighted cells to edit directly.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => onFilterChange("issues")}
                        className="text-[11px] font-bold underline hover:text-amber-950 shrink-0 ml-2"
                    >
                        View {issuesCount} Issues
                    </button>
                </div>
            )}
        </div>
    );
}

