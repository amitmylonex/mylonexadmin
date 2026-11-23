import type { ExcelCatalogRowMapped, ExcelStagedRow, FieldMappingSuggestion, WorkbookAnalysisResult } from "./row-types";
import { convertRowsWithRawCellsUsingMappings } from "./analyzer";
import { validateExcelRow, detectAndMarkBatchDuplicates } from "./validation";
import { getProposedDefaults } from "./fields";
import { mapSourceRow } from "./source-mapping";

export function revalidateStagedRow(row: ExcelStagedRow, data = row.data, names = new Set<string>()): ExcelStagedRow {
    return { ...row, ...validateExcelRow(data, row.rowNumber, names, row.originalData), id: row.id,
        editedFields: row.editedFields, isEdited: row.editedFields.length > 0 };
}

export function stageSheet(rawRows: unknown[][], analysis: WorkbookAnalysisResult, mappings: FieldMappingSuggestion[],
    names = new Set<string>()): ExcelStagedRow[] {
    return detectAndMarkBatchDuplicates(convertRowsWithRawCellsUsingMappings(rawRows, analysis.detectedHeaderRowIndex, mappings).map(item => {
        const customFields = Object.fromEntries(analysis.columns
            .map(c => [`source_${c.index}`, item.rawCells[c.index] ?? ""]));
        return { ...validateExcelRow(item.data, item.sourceRowNumber, names, item.data),
            id: `source:${analysis.selectedSheet}:${item.sourceRowNumber}`,
            sourceSheet: analysis.selectedSheet, sourceRowNumber: item.sourceRowNumber,
            originalData: { ...item.data }, rawCells: item.rawCells, customFields,
            originalCustomFields: { ...customFields }, editedFields: [], isEdited: false };
    }));
}

// Rebuild only unedited fields from this row's own source; never use display position.
export function remapStagedRow(row: ExcelStagedRow, headers: unknown[], mappings: FieldMappingSuggestion[], names = new Set<string>()) {
    if (row.isManuallyAdded) return row;
    const originalData = mapSourceRow(row.rawCells ?? [], headers, mappings);
    const effectiveCells = [...(row.rawCells ?? [])];
    for (const field of row.editedFields) if (field.startsWith("custom:source_")) {
        const key = field.slice("custom:".length);
        effectiveCells[Number(key.slice("source_".length))] = row.customFields[key];
    }
    const data = mapSourceRow(effectiveCells, headers, mappings);
    const editedFields = [...row.editedFields];
    for (const mapping of mappings) if (mapping.confidence === "matched" && row.editedFields.includes(`custom:source_${mapping.supplierColumnIndex}`)) {
        if (!editedFields.includes(mapping.targetFieldKey)) editedFields.push(mapping.targetFieldKey);
    }
    for (const field of row.editedFields) if (!field.startsWith("custom:")) {
        Object.assign(data, { [field]: row.data[field as keyof ExcelCatalogRowMapped] });
    }
    if (editedFields.includes("weightUnit")) data.unitConflicts = { ...data.unitConflicts, weight: undefined };
    if (editedFields.includes("widthUnit")) data.unitConflicts = { ...data.unitConflicts, width: undefined };
    return revalidateStagedRow({ ...row, originalData, editedFields }, data, names);
}

export function editStagedRow(row: ExcelStagedRow, key: string, value: unknown, isCustom = false, names = new Set<string>()) {
    const field = key === "gsm" ? "weightValue" : key === "widthInches" ? "widthValue" : key;
    const marker = isCustom ? `custom:${field}` : field;
    const editedFields = Array.from(new Set([...row.editedFields, marker]));
    if (isCustom) return { ...row, customFields: { ...row.customFields, [field]: value }, editedFields, isEdited: true };
    const data = { ...row.data, [field]: value };
    if (field === "weightUnit") data.unitConflicts = { ...data.unitConflicts, weight: undefined };
    if (field === "widthUnit") data.unitConflicts = { ...data.unitConflicts, width: undefined };
    if (field === "weightUnit") data.weightBasis = undefined;
    return revalidateStagedRow({ ...row, editedFields, defaultedFields: row.defaultedFields?.filter(f => f !== field) }, data, names);
}

export function resetStagedCell(row: ExcelStagedRow, field: string, isCustom = false, names = new Set<string>()) {
    const key = field === "gsm" ? "weightValue" : field === "widthInches" ? "widthValue" : field;
    const editedFields = row.editedFields.filter(f => f !== (isCustom ? `custom:${key}` : key));
    if (isCustom) return { ...row, editedFields, isEdited: editedFields.length > 0, customFields: { ...row.customFields, [key]: row.originalCustomFields[key] } };
    // Empty string records an intentional clear instead of reviving a canonical fallback.
    const data = { ...row.data, [key]: row.originalData[key as keyof ExcelCatalogRowMapped] ?? "" };
    if (key === "weightUnit") data.unitConflicts = { ...data.unitConflicts, weight: row.originalData.unitConflicts?.weight };
    if (key === "widthUnit") data.unitConflicts = { ...data.unitConflicts, width: row.originalData.unitConflicts?.width };
    return revalidateStagedRow({ ...row, editedFields, defaultedFields: row.defaultedFields?.filter(f => f !== key) }, data, names);
}

export function confirmStagedDefaults(row: ExcelStagedRow, names = new Set<string>()) {
    const proposed = getProposedDefaults(row.data);
    return revalidateStagedRow({ ...row,
        defaultedFields: [...(row.defaultedFields ?? []), ...proposed.map(([key]) => key)],
        editedFields: Array.from(new Set([...row.editedFields, ...proposed.map(([key]) => key)])),
    }, { ...row.data, ...Object.fromEntries(proposed) }, names);
}

export function buildImportPayloadRow(row: ExcelStagedRow) {
    return { ...row.data, clientRowId: row.id, sourceSheet: row.sourceSheet,
        sourceRowNumber: row.sourceRowNumber ?? row.rowNumber, sourceRawCells: row.rawCells?.map(value =>
            value === null || ["number", "boolean", "string"].includes(typeof value) ? value : String(value ?? "")),
        defaultedFields: row.defaultedFields ?? [] };
}
