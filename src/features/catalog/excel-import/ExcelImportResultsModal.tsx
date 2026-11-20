"use client";

import { type ExcelImportBatchResult } from "../excel/types";

interface ExcelImportResultsModalProps {
    result: ExcelImportBatchResult | null;
    onClose: () => void;
}

export default function ExcelImportResultsModal({
    result,
    onClose,
}: ExcelImportResultsModalProps) {
    if (!result) return null;

    const hasFailures = result.failedCount > 0;
    const isFullSuccess = result.importedCount > 0 && result.failedCount === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start gap-3.5">
                    <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                            isFullSuccess
                                ? "bg-emerald-100 text-emerald-700"
                                : hasFailures && result.importedCount > 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                        }`}
                    >
                        {isFullSuccess ? (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {isFullSuccess
                                ? "Import Completed Successfully"
                                : hasFailures && result.importedCount > 0
                                ? "Import Completed with Warnings"
                                : "Import Failed"}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600">
                            Processed {result.totalRows} fabric{result.totalRows === 1 ? "" : "s"} through the catalog creation pipeline.
                        </p>
                    </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Successfully Imported</span>
                        <p className="text-2xl font-black text-emerald-900 mt-0.5">{result.importedCount}</p>
                    </div>
                    <div
                        className={`rounded-xl border p-3 text-center ${
                            hasFailures
                                ? "border-rose-200 bg-rose-50/70 text-rose-900"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                    >
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Failed Rows</span>
                        <p className="text-2xl font-black mt-0.5">{result.failedCount}</p>
                    </div>
                </div>

                {/* Failure breakdown if any */}
                {hasFailures && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Failure Details</h4>
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/40 p-3 space-y-2 text-xs">
                            {result.failures.map((f, i) => (
                                <div key={i} className="flex items-start gap-2 border-b border-rose-100 pb-2 last:border-b-0 last:pb-0">
                                    <span className="font-mono text-rose-800 font-bold shrink-0">Row {f.rowNumber}:</span>
                                    <div className="text-rose-900">
                                        <span className="font-semibold">{f.fabricName || "Unnamed"}</span>
                                        <p className="text-[11px] text-rose-700 mt-0.5">{f.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

