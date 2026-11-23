import { analyzeWorkbook, readWorkbook, getSheetRawRows, convertRowsUsingMappings } from "./analyzer";
import type { ExcelCatalogRowMapped } from "./row-types";
export interface ParseExcelResult { ok: boolean; rows: ExcelCatalogRowMapped[]; sheetName?: string; error?: string }
/** Compatibility entry point; all imports now use the same detector and mapping registry. */
export function parseExcelBuffer(buffer: ArrayBuffer | Uint8Array): ParseExcelResult {
    try {
        const workbook = readWorkbook(buffer);
        const preferred = workbook.SheetNames.find(name => name.trim().toLowerCase() === "fabric catalog import");
        const analysis = analyzeWorkbook(workbook, preferred);
        const rows = convertRowsUsingMappings(getSheetRawRows(workbook, analysis.selectedSheet), analysis.detectedHeaderRowIndex, analysis.mappings);
        if (!rows.length) return { ok: false, rows: [], error: "The uploaded sheet contains no data rows." };
        return { ok: true, rows, sheetName: analysis.selectedSheet };
    } catch (error) { return { ok: false, rows: [], error: "Corrupted or invalid Excel file: " + (error instanceof Error ? error.message : "Could not parse workbook") }; }
}
