"use client";

import {
    type DetectedColumn,
    type ExcelCatalogRowMapped,
    type FieldMappingSuggestion,
} from "../excel/types";

interface ExcelImportMappingMobileProps {
    mappings: FieldMappingSuggestion[];
    columns: DetectedColumn[];
    onMappingChange: (
        _targetFieldKey: keyof ExcelCatalogRowMapped,
        _supplierColIndex: number | null
    ) => void;
}

export default function ExcelImportMappingMobile({
    mappings,
    columns,
    onMappingChange,
}: ExcelImportMappingMobileProps) {
    return (
        <div className="space-y-3.5">
            {mappings.map((mapping) => {
                const selectedCol = columns.find(
                    (c) => c.index === mapping.supplierColumnIndex
                );

                const statusBadge =
                    mapping.confidence === "matched"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : mapping.confidence === "review"
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : "bg-slate-100 text-slate-600 border-slate-300";

                const statusLabel =
                    mapping.confidence === "matched"
                        ? "✓ Matched"
                        : mapping.confidence === "review"
                        ? "⚠ Review"
                        : "— Unmapped";

                return (
                    <div
                        key={mapping.targetFieldKey}
                        className={`rounded-xl border p-4 space-y-3 bg-white shadow-2xs ${
                            mapping.required && mapping.supplierColumnIndex === null
                                ? "border-rose-300 bg-rose-50/10"
                                : "border-slate-200"
                        }`}
                    >
                        {/* Header: Field Label & Status Pill */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-900">
                                    {mapping.targetLabel}
                                </span>
                                {mapping.required && (
                                    <span className="text-rose-500 font-bold text-sm" title="Required field">*</span>
                                )}
                            </div>

                            <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${statusBadge}`}
                                title={mapping.confidenceReason}
                            >
                                {statusLabel}
                            </span>
                        </div>

                        {mapping.required && mapping.supplierColumnIndex === null && (
                            <p className="text-xs text-rose-600 font-medium">
                                This required field must be mapped to a supplier column.
                            </p>
                        )}

                        {/* Supplier Column Selector */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Supplier Column
                            </label>
                            <select
                                        aria-label={mapping.targetLabel + " source column"}
                                value={
                                    mapping.supplierColumnIndex !== null
                                        ? String(mapping.supplierColumnIndex)
                                        : ""
                                }
                                onChange={(e) => {
                                    const val = e.target.value;
                                    onMappingChange(
                                        mapping.targetFieldKey,
                                        val === "" ? null : Number(val)
                                    );
                                }}
                                className={`w-full min-h-[42px] h-[42px] rounded-lg border px-3 py-2 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 transition-all ${
                                    mapping.required && mapping.supplierColumnIndex === null
                                        ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                                        : "border-slate-300 focus:border-primary focus:ring-primary/20"
                                }`}
                            >
                                <option value="">(Do not map)</option>
                                {columns.map((col) => (
                                    <option key={col.index} value={col.index}>
                                        {col.rawHeader} (Col #{col.index + 1})
                                    </option>
                                ))}
                            </select>
                                    {mapping.confidence === "review" && mapping.supplierColumnIndex !== null && <button type="button" className="mt-2 text-xs text-amber-800 underline" onClick={() => onMappingChange(mapping.targetFieldKey, mapping.supplierColumnIndex)}>Confirm suggested mapping</button>}
                        </div>

                        {/* Sample Data Preview */}
                        {selectedCol && selectedCol.sampleValues.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-slate-100">
                                <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                    Sample Values:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {selectedCol.sampleValues.map((sample, sIdx) => (
                                        <span
                                            key={sIdx}
                                            className="inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-700 truncate max-w-xs"
                                        >
                                            {sample}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

