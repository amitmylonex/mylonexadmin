"use client";

import ExcelImportEditableCell from "./ExcelImportEditableCell";
import { getProposedDefaults, TARGET_CATALOG_FIELDS, type TargetFieldConfig } from "../excel/fields";
import type { ExcelStagedRow } from "../excel/types";

export type RowProps = {
    row: ExcelStagedRow;
    onCellChange: (_id: string, _key: string, _value: unknown, _custom?: boolean) => void;
    onResetCell: (_id: string, _key: string, _custom?: boolean) => void;
    onResetRow: (_id: string) => void; onDuplicateRow: (_id: string) => void; onDeleteRow: (_id: string) => void;
    onConfirmDefaults: (_id: string) => void;
};

export function CatalogField({ row, field, onCellChange, onResetCell }: Pick<RowProps, "row" | "onCellChange" | "onResetCell"> & { field: TargetFieldConfig }) {
    const key = field.key;
    const value = key === "finishOptions" ? row.data.finishOptions?.join(", ") : row.data[key];
    const original = key === "finishOptions" ? row.originalData.finishOptions?.join(", ") : row.originalData[key];
    const options = field.options?.map(option => ({ value: option, label: option.replace(/[_-]/g, " ") }));
    if (options && value && !options.some(option => option.value === value)) options.unshift({ value: String(value), label: `Supplied: ${value}` });
    const unitKey = key === "weightValue" ? "weightUnit" : key === "widthValue" ? "widthUnit" : undefined;
    const units = key === "weightValue" ? ["GSM", "OZ", "GLM"] : ["inches", "cm"];
    return <div className="catalog-review-field min-w-[170px] space-y-1">
        <ExcelImportEditableCell rowId={row.id} fieldKey={key} currentValue={value} originalValue={original}
            isEdited={row.editedFields.includes(key)} isManuallyAdded={row.isManuallyAdded} cellMeta={row.cellMeta?.[key]}
            issue={row.issues.find(issue => issue.field === key)} type={options ? "select" : "text"} options={options}
            placeholder={key === "fabricName" ? "Optional supplier name" : "Not supplied"}
            onChange={next => onCellChange(row.id, key, key === "finishOptions" ? String(next).split(/[,;]/).map(v => v.trim()).filter(Boolean) : next)}
            onReset={() => onResetCell(row.id, key)} />
        {unitKey && <label className="catalog-review-unit block text-xs text-slate-600">Unit
            <select aria-label={`${field.label} unit`} className="ml-2 rounded border border-slate-300 p-1"
                value={row.data[unitKey] ?? ""} onChange={event => onCellChange(row.id, unitKey, event.target.value)}>
                <option value="">Confirm unit</option>{units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
            {row.issues.filter(issue => issue.field === unitKey).map(issue => <span key={issue.message} className="block text-rose-700">{issue.message}</span>)}
        </label>}
        {row.defaultedFields?.includes(key) && <span className="block text-xs text-blue-700">Confirmed default · absent in source</span>}
    </div>;
}

export function RowActions({ row, onResetRow, onDuplicateRow, onDeleteRow, onConfirmDefaults }: RowProps) {
    const defaults = getProposedDefaults(row.data);
    return <div className="space-y-2 min-w-[200px] text-xs">
        <p className="font-semibold">{row.statusLabel}</p>
        {row.issues.filter(issue => issue.field === "general").map(issue => <p key={issue.message} className="text-rose-800">{issue.message}</p>)}
        <p>{row.sourceSheet ? `${row.sourceSheet} · Excel row ${row.sourceRowNumber}` : "Manually added"}</p>
        {defaults.length > 0 && <details><summary className="cursor-pointer text-amber-800">Review {defaults.length} proposed defaults</summary>
            <ul className="my-2 space-y-1">{defaults.map(([key, value]) => <li key={key}>{TARGET_CATALOG_FIELDS.find(f => f.key === key)?.label ?? key}: {String(value)}</li>)}</ul>
            <button type="button" className="btn-ghost" onClick={() => onConfirmDefaults(row.id)}>Confirm listed defaults</button>
        </details>}
        {row.isDuplicateInFile && <p className="text-amber-800">Exact duplicate: server will create or skip using the existing policy.</p>}
        <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onResetRow(row.id)}>Reset row</button>
            <button type="button" onClick={() => onDuplicateRow(row.id)}>Duplicate</button>
            <button type="button" className="text-rose-700" onClick={() => onDeleteRow(row.id)}>Remove row</button>
        </div>
    </div>;
}

