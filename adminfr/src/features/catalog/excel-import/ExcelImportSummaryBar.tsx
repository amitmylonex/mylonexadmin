"use client";

import { type ExcelImportSummary } from "../excel/types";

interface ExcelImportSummaryBarProps {
    summary: ExcelImportSummary;
    activeFilter: "all" | "ready" | "issues";
    onFilterChange: (_filter: "all" | "ready" | "issues") => void;
    onImport: () => void;
    isImporting: boolean;
    onReset: () => void;
    filename?: string;
}

export default function ExcelImportSummaryBar({
    summary,
    activeFilter,
    onFilterChange,
    onImport,
    isImporting,
    onReset,
    filename,
}: ExcelImportSummaryBarProps) {
    const { totalRows, readyCount, issuesCount } = summary;

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5 shadow-xs space-y-4 max-w-full min-w-0">
            {/* Top row: File info + Primary Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="space-y-0.5 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Excel File Staged</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 truncate">
                        <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate" title={filename || "Uploaded File"}>
                            {filename || "mylonex-fabric-catalog.xlsx"}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={isImporting}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50 shadow-2xs"
                    >
                        Clear / New File
                    </button>

                    <button
                        type="button"
                        onClick={onImport}
                        disabled={readyCount === 0 || isImporting}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-xs transition-all ${
                            readyCount === 0 || isImporting
                                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]"
                        }`}
                    >
                        {isImporting ? (
                            <>
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Importing Fabrics...
                            </>
                        ) : (
                            <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Import {readyCount} Ready Fabric{readyCount === 1 ? "" : "s"}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Bottom row: KPI counts + Segmented Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* KPI badges */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
                        <span>Total Rows:</span>
                        <span className="font-bold text-slate-900">{totalRows}</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs">
                        <span className="font-bold">✓ Ready:</span>
                        <span className="font-black text-emerald-900">{readyCount}</span>
                    </div>

                    {issuesCount > 0 && (
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs">
                            <span className="font-bold">⚠ Issues:</span>
                            <span className="font-black text-amber-900">{issuesCount}</span>
                        </div>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-2xs self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => onFilterChange("all")}
                        className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                            activeFilter === "all"
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        All ({totalRows})
                    </button>
                    <button
                        type="button"
                        onClick={() => onFilterChange("ready")}
                        className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                            activeFilter === "ready"
                                ? "bg-emerald-700 text-white shadow-2xs"
                                : "text-emerald-700 hover:text-emerald-900"
                        }`}
                    >
                        ✓ Ready ({readyCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => onFilterChange("issues")}
                        className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                            activeFilter === "issues"
                                ? "bg-amber-600 text-white shadow-2xs"
                                : "text-amber-700 hover:text-amber-900"
                        }`}
                    >
                        ⚠ Issues ({issuesCount})
                    </button>
                </div>
            </div>
        </div>
    );
}

