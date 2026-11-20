"use client";

import {
    type DetectedColumn,
    type ExcelCatalogRowMapped,
    type FieldMappingSuggestion,
} from "../excel/types";

interface ExcelImportUnmappedColumnsProps {
    unmappedColumns: DetectedColumn[];
    availableTargetFields: FieldMappingSuggestion[];
    onQuickMap: (
        _targetFieldKey: keyof ExcelCatalogRowMapped,
        _supplierColIndex: number
    ) => void;
}

export default function ExcelImportUnmappedColumns({
    unmappedColumns,
    availableTargetFields,
    onQuickMap,
}: ExcelImportUnmappedColumnsProps) {
    if (unmappedColumns.length === 0) {
        return null;
    }

    const unmappedTargets = availableTargetFields.filter(
        (f) => f.supplierColumnIndex === null
    );

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">
                        Unmapped Supplier Columns ({unmappedColumns.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        These columns will <span className="font-semibold text-slate-700">not be imported</span> unless mapped to a MyloNex field.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {unmappedColumns.map((col) => (
                    <div
                        key={col.index}
                        className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-2xs"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate" title={col.rawHeader}>
                                {col.rawHeader}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Col #{col.index + 1}
                            </span>
                        </div>

                        {col.sampleValues.length > 0 && (
                            <p className="text-[11px] text-slate-500 truncate" title={col.sampleValues.join(", ")}>
                                Sample: <span className="text-slate-700 font-medium">{col.sampleValues.slice(0, 2).join(", ")}</span>
                            </p>
                        )}

                        {unmappedTargets.length > 0 ? (
                            <div className="pt-1 border-t border-slate-100">
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                    Map to MyloNex field:
                                </label>
                                <select
                                    defaultValue=""
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            onQuickMap(e.target.value as keyof ExcelCatalogRowMapped, col.index);
                                        }
                                    }}
                                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="" disabled>Select MyloNex field...</option>
                                    {unmappedTargets.map((t) => (
                                        <option key={t.targetFieldKey} value={t.targetFieldKey}>
                                            {t.targetLabel} {t.required ? "*" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-100">
                                All available fields are already mapped.
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

