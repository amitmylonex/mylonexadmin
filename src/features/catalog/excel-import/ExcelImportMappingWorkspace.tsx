"use client";

import { useMemo, useState } from "react";
import {
    type DetectedColumn,
    type ExcelCatalogRowMapped,
    type FieldMappingSuggestion,
    type HeaderRowCandidate,
    type WorkbookAnalysisResult,
} from "../excel/types";
import ExcelImportMappingTable from "./ExcelImportMappingTable";
import ExcelImportMappingMobile from "./ExcelImportMappingMobile";
import ExcelImportUnmappedColumns from "./ExcelImportUnmappedColumns";

interface ExcelImportMappingWorkspaceProps {
    filename: string;
    analysis: WorkbookAnalysisResult;
    mappings: FieldMappingSuggestion[];
    onSheetChange: (_sheetName: string) => void;
    onHeaderRowChange: (_headerRowIndex: number) => void;
    onMappingChange: (
        _targetFieldKey: keyof ExcelCatalogRowMapped,
        _supplierColIndex: number | null
    ) => void;
    onContinueToPreview: () => void;
    onUploadDifferentFile: () => void;
}

export default function ExcelImportMappingWorkspace({
    filename,
    analysis,
    mappings,
    onSheetChange,
    onHeaderRowChange,
    onMappingChange,
    onContinueToPreview,
    onUploadDifferentFile,
}: ExcelImportMappingWorkspaceProps) {
    const [showSheetPreview, setShowSheetPreview] = useState(false);

    // Compute unmapped supplier columns based on current mappings
    const mappedColumnIndices = useMemo(() => {
        const set = new Set<number>();
        for (const m of mappings) {
            if (m.supplierColumnIndex !== null && m.confidence === "matched") {
                set.add(m.supplierColumnIndex);
            }
        }
        return set;
    }, [mappings]);

    const unmappedSupplierColumns: DetectedColumn[] = useMemo(() => {
        return analysis.columns.filter((c) => !mappedColumnIndices.has(c.index));
    }, [analysis.columns, mappedColumnIndices]);

    // Validation: check that required MyloNex fields are mapped
    const missingRequiredFields = useMemo(() => {
        return mappings.filter((m) => m.required && m.supplierColumnIndex === null);
    }, [mappings]);

    const canContinue = missingRequiredFields.length === 0;

    return (
        <div className="space-y-6 w-full max-w-full min-w-0">
            {/* Top Config Card: File, Sheet Selection, and Header Row Detection */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    {/* Left: File & Sheet details */}
                    <div className="flex flex-wrap items-center gap-4 min-w-0">
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                File Uploaded
                            </span>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 truncate">
                                <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="truncate max-w-[220px]" title={filename}>{filename}</span>
                            </div>
                        </div>

                        {/* Sheet Selector */}
                        <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Sheet ({analysis.sheets.length})
                            </label>
                            <select
                                aria-label="Worksheet"
                                value={analysis.selectedSheet}
                                onChange={(e) => onSheetChange(e.target.value)}
                                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {analysis.sheets.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {/* Header Row Selector */}
                        <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Header Row
                            </label>
                            <select
                                aria-label="Header row"
                                value={analysis.detectedHeaderRowIndex}
                                onChange={(e) => onHeaderRowChange(Number(e.target.value))}
                                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {analysis.candidateHeaderRows.map((candidate: HeaderRowCandidate) => (
                                    <option key={candidate.index} value={candidate.index}>
                                        Row {candidate.displayRowNumber} ({candidate.columnCount} cols)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Right: Quick actions */}
                    <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-auto">
                        <button
                            type="button"
                            onClick={() => setShowSheetPreview(!showSheetPreview)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                        >
                            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {showSheetPreview ? "Hide Sheet Preview" : "Preview Raw Rows"}
                        </button>

                        <button
                            type="button"
                            onClick={onUploadDifferentFile}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                        >
                            Upload Different File
                        </button>
                    </div>
                </div>

                {/* Optional Expandable Raw Sheet Preview */}
                {showSheetPreview && (
                    <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                            <span className="font-semibold">Raw Sheet Sample (First 5 Rows):</span>
                            <span className="text-[11px] text-slate-500">
                                Current Header: <span className="font-bold text-slate-900">Row {analysis.detectedHeaderRowIndex + 1}</span>
                            </span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white max-h-48 overflow-y-auto">
                            <table className="w-full text-left text-[11px] font-mono">
                                <tbody className="divide-y divide-slate-100">
                                    {analysis.samplePreviewRows.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-slate-50">
                                            <td className="py-1 px-2.5 bg-slate-50 font-bold text-slate-400 border-r border-slate-100 w-12 text-center">
                                                #{rIdx + analysis.detectedHeaderRowIndex + 2}
                                            </td>
                                            {Array.isArray(row) &&
                                                row.map((cell, cIdx) => (
                                                    <td key={cIdx} className="py-1 px-2.5 text-slate-700 truncate max-w-xs border-r border-slate-100">
                                                        {String(cell ?? "")}
                                                    </td>
                                                ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Column Mapping Section */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Column Mapping</h3>
                        <p className="text-xs text-slate-500">
                            Match columns from your uploaded spreadsheet to MyloNex catalog attributes.
                        </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 self-start sm:self-auto bg-slate-100 px-2.5 py-1 rounded-md">
                        {analysis.columns.length} columns detected in sheet
                    </span>
                </div>

                {/* Desktop / Tablet Mapping Table */}
                <div className="hidden md:block w-full max-w-full min-w-0">
                    <ExcelImportMappingTable
                        mappings={mappings}
                        columns={analysis.columns}
                        onMappingChange={onMappingChange}
                    />
                </div>

                {/* Mobile Mapping Cards */}
                <div className="block md:hidden w-full max-w-full min-w-0">
                    <ExcelImportMappingMobile
                        mappings={mappings}
                        columns={analysis.columns}
                        onMappingChange={onMappingChange}
                    />
                </div>
            </div>

            {/* Unmapped Supplier Columns */}
            <ExcelImportUnmappedColumns
                unmappedColumns={unmappedSupplierColumns}
                availableTargetFields={mappings}
                onQuickMap={onMappingChange}
            />

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                <div>
                    {!canContinue ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-rose-700">
                            <svg className="h-4 w-4 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>
                                Map required fields (*):{" "}
                                <strong className="font-bold">
                                    {missingRequiredFields.map((f) => f.targetLabel).join(", ")}
                                </strong>{" "}
                                before continuing.
                            </span>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-600">
                            Proceed to review. Unmapped values can be entered manually; review suggestions must be confirmed before they supply data.
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <button
                        type="button"
                        onClick={onUploadDifferentFile}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onContinueToPreview}
                        disabled={!canContinue}
                        className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all ${
                            canContinue
                                ? "bg-slate-900 hover:bg-slate-800 active:scale-[0.99]"
                                : "bg-slate-300 text-slate-500 cursor-not-allowed"
                        }`}
                    >
                        <span>Continue to Edit &amp; Review Data</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

