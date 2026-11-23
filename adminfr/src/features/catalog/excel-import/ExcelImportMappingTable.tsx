"use client";

import {
    type DetectedColumn,
    type ExcelCatalogRowMapped,
    type FieldMappingSuggestion,
} from "../excel/types";

interface ExcelImportMappingTableProps {
    mappings: FieldMappingSuggestion[];
    columns: DetectedColumn[];
    onMappingChange: (
        _targetFieldKey: keyof ExcelCatalogRowMapped,
        _supplierColIndex: number | null
    ) => void;
}

export default function ExcelImportMappingTable({
    mappings,
    columns,
    onMappingChange,
}: ExcelImportMappingTableProps) {
    return (
        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-2xs">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="bg-slate-100 border-b-2 border-slate-200">
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <th className="py-3 px-4 w-72">MyloNex Field</th>
                        <th className="py-3 px-4 w-72">Supplier Column</th>
                        <th className="py-3 px-4">Sample Values</th>
                        <th className="py-3 px-4 w-36 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                            <tr
                                key={mapping.targetFieldKey}
                                className={`transition-colors hover:bg-slate-50/60 ${
                                    mapping.required && mapping.supplierColumnIndex === null
                                        ? "bg-rose-50/15"
                                        : ""
                                }`}
                            >
                                {/* MyloNex Field */}
                                <td className="py-3.5 px-4 align-middle">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-sm text-slate-900">
                                                {mapping.targetLabel}
                                            </span>
                                            {mapping.required && (
                                                <span className="text-rose-500 font-bold text-sm" title="Required field">*</span>
                                            )}
                                        </div>
                                        {mapping.required && mapping.supplierColumnIndex === null && (
                                            <p className="text-[11px] text-rose-600 font-medium">
                                                Required field must be mapped
                                            </p>
                                        )}
                                    </div>
                                </td>

                                {/* Supplier Column Dropdown */}
                                <td className="py-3.5 px-4 align-middle">
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
                                        className={`w-full min-h-[40px] h-[40px] rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 transition-all ${
                                            mapping.required && mapping.supplierColumnIndex === null
                                                ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                                                : "border-slate-300 hover:border-slate-400 focus:border-primary focus:ring-primary/20"
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
                                </td>

                                {/* Sample Values */}
                                <td className="py-3.5 px-4 align-middle">
                                    {selectedCol && selectedCol.sampleValues.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 max-w-md">
                                            {selectedCol.sampleValues.map((sample, sIdx) => (
                                                <span
                                                    key={sIdx}
                                                    className="inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-700 max-w-[200px] truncate"
                                                    title={sample}
                                                >
                                                    {sample}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-slate-400 italic">
                                            {mapping.supplierColumnIndex !== null
                                                ? "No sample data"
                                                : "No column selected"}
                                        </span>
                                    )}
                                </td>

                                {/* Status */}
                                <td className="py-3.5 px-4 align-middle text-center">
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${statusBadge}`}
                                        title={mapping.confidenceReason}
                                    >
                                        {statusLabel}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

