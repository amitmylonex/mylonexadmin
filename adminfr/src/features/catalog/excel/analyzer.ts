import * as XLSX from "xlsx";
import type { ExcelCatalogRowMapped, FieldMappingSuggestion, WorkbookAnalysisResult } from "./row-types";
import { suggestFieldMappings } from "./matcher";
import { detectHeaderRow, extractColumnsFromSheet } from "./sheet-detection";
import { mapSourceRow } from "./source-mapping";
export { detectHeaderRow, extractColumnsFromSheet } from "./sheet-detection";

export function readWorkbook(buffer: ArrayBuffer | Uint8Array): XLSX.WorkBook {
    return XLSX.read(buffer, { type: "array" });
}

export function getSheetRawRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true, defval: "", range: 0 }) as unknown[][];
}

export function analyzeWorkbook(
    workbook: XLSX.WorkBook,
    preferredSheet?: string,
    overrideHeaderRowIndex?: number
): WorkbookAnalysisResult {
    const sheets = workbook.SheetNames || [];
    if (sheets.length === 0) {
        throw new Error("The uploaded Excel workbook contains no sheets.");
    }

    // Default to preferred sheet or first sheet with data
    const selectedSheet =
        preferredSheet && sheets.includes(preferredSheet)
            ? preferredSheet
            : sheets.find(name => getSheetRawRows(workbook, name).some(row => row.some(cell => String(cell ?? "").trim()))) ?? sheets[0];

    const rawRows = getSheetRawRows(workbook, selectedSheet);
    if (rawRows.length === 0) {
        return {
            sheets,
            selectedSheet,
            totalRowsInSheet: 0,
            detectedHeaderRowIndex: 0,
            candidateHeaderRows: [],
            columns: [],
            mappings: [],
            unmappedColumns: [],
            samplePreviewRows: [],
        };
    }

    // Determine header row index
    const { detectedIndex, candidates } = detectHeaderRow(rawRows);
    const headerRowIndex =
        overrideHeaderRowIndex !== undefined &&
        overrideHeaderRowIndex >= 0 &&
        overrideHeaderRowIndex < rawRows.length
            ? overrideHeaderRowIndex
            : detectedIndex;

    const columns = extractColumnsFromSheet(rawRows, headerRowIndex);
    const { mappings, unmappedColumns } = suggestFieldMappings(columns);

    // Extract sample preview rows (first 5 rows below header)
    const samplePreviewRows = rawRows.slice(
        headerRowIndex + 1,
        Math.min(rawRows.length, headerRowIndex + 6)
    );

    return {
        sheets,
        selectedSheet,
        totalRowsInSheet: rawRows.length,
        detectedHeaderRowIndex: headerRowIndex,
        candidateHeaderRows: candidates,
        columns,
        mappings,
        unmappedColumns,
        samplePreviewRows,
    };
}


export function convertRowsUsingMappings(rawRows: unknown[][], headerRowIndex: number,
    mappings: Array<Pick<FieldMappingSuggestion, "targetFieldKey" | "supplierColumnIndex"> & Partial<FieldMappingSuggestion>>) {
    return convertRowsWithRawCellsUsingMappings(rawRows, headerRowIndex, mappings).map(row => row.data);
}

export function convertRowsWithRawCellsUsingMappings(rawRows: unknown[][], headerRowIndex: number,
    mappings: Array<Pick<FieldMappingSuggestion, "targetFieldKey" | "supplierColumnIndex"> & Partial<FieldMappingSuggestion>>)
    : Array<{ data: ExcelCatalogRowMapped; rawCells: unknown[]; sourceRowNumber: number }> {
    const headers = rawRows[headerRowIndex] ?? [];
    return rawRows.flatMap((rawCells, index) => index <= headerRowIndex || !rawCells.some(cell => String(cell ?? "").trim()) ? [] : [{
        data: mapSourceRow(rawCells, headers, mappings), rawCells: [...rawCells], sourceRowNumber: index + 1,
    }]);
}
