"use client";

import { useMemo, useState } from "react";
import type * as XLSX from "xlsx";
import { analyzeWorkbook, getSheetRawRows, readWorkbook } from "../excel/analyzer";
import { confirmStagedDefaults, editStagedRow, remapStagedRow, resetStagedCell, revalidateStagedRow, stageSheet } from "../excel/staging";
import { detectAndMarkBatchDuplicates, validateExcelRow } from "../excel/validation";
import { isShadeColumn } from "../excel/fields";
import type { ExcelCatalogRowMapped, ExcelStagedRow, FieldMappingSuggestion, WorkbookAnalysisResult } from "../excel/types";

type Workspace = { analysis: WorkbookAnalysisResult; mappings: FieldMappingSuggestion[]; rows: ExcelStagedRow[]; deleted: string[] };
export type ImportStep = "upload" | "mapping" | "edit" | "preview";

export function useExcelImportWorkspace(existingNames: string[]) {
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [filename, setFilename] = useState("");
    const [selectedSheet, setSelectedSheet] = useState("");
    const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
    const [importStep, setImportStep] = useState<ImportStep>("upload");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<"all" | "ready" | "issues">("all");
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [revision, setRevision] = useState(0);
    const names = useMemo(() => new Set(existingNames.map(n => n.trim().toLowerCase())), [existingNames]);
    const workspace = workspaces[selectedSheet];
    const change = (fn: (_value: Workspace) => Workspace) => {
        setRevision(value => value + 1);
        setWorkspaces(prev => ({ ...prev, [selectedSheet]: fn(prev[selectedSheet]) }));
    };
    const changeRows = (fn: (_rows: ExcelStagedRow[]) => ExcelStagedRow[]) => change(w => ({ ...w, rows: detectAndMarkBatchDuplicates(fn(w.rows)) }));
    const create = (wb: XLSX.WorkBook, sheet?: string): Workspace => {
        const analysis = analyzeWorkbook(wb, sheet);
        const raw = getSheetRawRows(wb, analysis.selectedSheet);
        if (raw.slice(analysis.detectedHeaderRowIndex + 1).filter(row => row.some(cell => String(cell ?? "").trim())).length > 500)
            throw new Error("This sheet contains more than 500 data rows. Split it into batches of at most 500 rows.");
        const rows = stageSheet(raw, analysis, analysis.mappings, names);
        return { analysis, mappings: analysis.mappings, rows,
            deleted: [] };
    };
    const handleWorkbookLoaded = (buffer: ArrayBuffer, name: string) => {
        try {
            const wb = readWorkbook(buffer); const initial = create(wb);
            setWorkbook(wb); setFilename(name); setSelectedSheet(initial.analysis.selectedSheet);
            setRevision(value => value + 1);
            setWorkspaces({ [initial.analysis.selectedSheet]: initial }); setErrorMessage(null);
            setImportStep("mapping");
        } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Could not read workbook."); }
    };
    const handleSheetChange = (sheet: string) => {
        if (!workbook) return;
        try {
            if (!workspaces[sheet]) { const next = create(workbook, sheet); setWorkspaces(prev => ({ ...prev, [sheet]: next })); }
            setSelectedSheet(sheet);
        } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Could not select sheet."); }
    };
    const handleMappingChange = (key: keyof ExcelCatalogRowMapped, index: number | null) => {
        if (!workspace || !workbook) return;
        if (key === "fabricName" && index !== null && isShadeColumn(workspace.analysis.columns.find(c => c.index === index)?.rawHeader ?? "")) {
            setErrorMessage("Color/Shade columns cannot be mapped to Fabric Name. Keep them in staging for the separate shade-import decision."); return;
        }
        change(w => {
            const mappings = w.mappings.map(m => m.targetFieldKey === key ? { ...m, supplierColumnIndex: index,
                supplierColumnName: w.analysis.columns.find(c => c.index === index)?.rawHeader ?? null,
                confidence: index === null ? "unmapped" as const : "matched" as const, confidenceReason: "Confirmed by user" }
                : index !== null && m.supplierColumnIndex === index ? { ...m, supplierColumnIndex: null, supplierColumnName: null, confidence: "unmapped" as const } : m);
            const headers = getSheetRawRows(workbook, selectedSheet)[w.analysis.detectedHeaderRowIndex] ?? [];
            return { ...w, mappings, rows: detectAndMarkBatchDuplicates(w.rows.map(row => remapStagedRow(row, headers, mappings, names))) };
        });
        setErrorMessage(null);
    };
    const handleHeaderRowChange = (index: number) => {
        if (!workbook) return;
        const rawRows = getSheetRawRows(workbook, selectedSheet);
        if (rawRows.slice(index + 1).filter(row => row.some(cell => String(cell ?? "").trim())).length > 500) {
            setErrorMessage("This header would select more than 500 data rows. Split the sheet into smaller batches."); return;
        }
        change(w => {
            const analysis = analyzeWorkbook(workbook, selectedSheet, index);
            const raw = getSheetRawRows(workbook, selectedSheet);
            const initial = stageSheet(raw, analysis, analysis.mappings, names);
            const rows = initial.filter(r => !w.deleted.includes(r.id)).map(r => {
                const previous = w.rows.find(old => old.id === r.id);
                return previous ? remapStagedRow(previous, raw[index], analysis.mappings, names) : r;
            });
            return { ...w, analysis, mappings: analysis.mappings, rows: detectAndMarkBatchDuplicates([...rows, ...w.rows.filter(r => r.isManuallyAdded)]) };
        });
    };
    const handleCellChange = (id: string, key: string, value: unknown, custom = false) =>
        changeRows(rows => rows.map(row => row.id === id ? editStagedRow(row, key, value, custom, names) : row));
    const handleResetCell = (id: string, key: string, custom = false) =>
        changeRows(rows => rows.map(row => row.id === id ? resetStagedCell(row, key, custom, names) : row));
    const handleResetRow = (id: string) => changeRows(rows => rows.map(row => row.id !== id ? row : revalidateStagedRow({ ...row,
        customFields: { ...row.originalCustomFields }, editedFields: [], defaultedFields: [] }, { ...row.originalData }, names)));
    const handleAddRow = () => {
        if ((workspace?.rows.length ?? 0) >= 500) { setErrorMessage("A batch can contain at most 500 rows."); return; }
        changeRows(rows => [...rows, { ...validateExcelRow({}, rows.length + 1), id: `manual:${crypto.randomUUID()}`,
            originalData: {}, customFields: {}, originalCustomFields: {}, editedFields: [], isEdited: false, isManuallyAdded: true }]);
    };
    const handleDuplicateRow = (id: string) => {
        if ((workspace?.rows.length ?? 0) >= 500) { setErrorMessage("A batch can contain at most 500 rows."); return; }
        changeRows(rows => {
        const row = rows.find(r => r.id === id); if (!row) return rows;
        const data = { ...row.data, fabricName: `${row.data.fabricName || "Fabric"} (Copy)` };
        return [...rows, { ...row, ...validateExcelRow(data, row.rowNumber, names), id: `manual:${crypto.randomUUID()}`,
            sourceRowNumber: undefined, sourceSheet: undefined, originalData: data, isManuallyAdded: true }];
        });
    };
    const handleDeleteRow = (id: string) => change(w => ({ ...w, deleted: [...w.deleted, id], rows: detectAndMarkBatchDuplicates(w.rows.filter(r => r.id !== id)) }));
    const handleConfirmDefaults = (id: string) => changeRows(rows => rows.map(row => row.id === id ? confirmStagedDefaults(row, names) : row));
    const handleConfirmAllDefaults = () => changeRows(rows => rows.map(row => confirmStagedDefaults(row, names)));
    const handleUploadDifferentFile = () => { setWorkbook(null); setWorkspaces({}); setSelectedSheet(""); setFilename(""); setImportStep("upload"); setErrorMessage(null); setIsConfirmOpen(false); };
    return { workbook, filename, revision, analysis: workspace?.analysis, mappings: workspace?.mappings ?? [], stagedRows: workspace?.rows ?? [],
        importStep, setImportStep, activeFilter, setActiveFilter, errorMessage, setErrorMessage, isConfirmOpen, setIsConfirmOpen,
        handleWorkbookLoaded, handleSheetChange, handleMappingChange, handleHeaderRowChange, handleCellChange, handleResetCell,
        handleResetRow, handleAddRow, handleDuplicateRow, handleDeleteRow,
        handleConfirmDefaults, handleConfirmAllDefaults, handleUploadDifferentFile };
}

