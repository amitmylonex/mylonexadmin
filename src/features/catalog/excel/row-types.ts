import type { ExcelFabricType, ExcelFabricState, ExcelDyeMethod, ExcelProductionCycle, ExcelMaterialPurity } from "./allowed-values";

export interface ExcelCatalogRowMapped {
    fabricName?: string;
    /** Legacy metadata accepted from older clients; conversions no longer require confirmation. */
    weightBasis?: "oz-per-square-yard" | "glm-full-width";
    unitConflicts?: { weight?: string; width?: string };
    fabricType?: ExcelFabricType | string;
    composition?: string;
    weightUnit?: "GSM" | "OZ" | "GLM";
    weightValue?: number | string;
    /** Mapping-only GLM fallback. Resolved to weightValue/unit before staging. */
    weightGlm?: number | string;
    gsm?: number | string;
    widthUnit?: "inches" | "cm";
    widthValue?: number | string;
    widthInches?: number | string;
    yarnType?: string;
    count?: string;
    countWarp?: string;
    countWeft?: string;
    countAddition?: string;
    construction?: string;
    constructionEpi?: string;
    constructionPpi?: string;
    weaveType?: string;
    fabricState?: ExcelFabricState | string;
    dyeMethod?: ExcelDyeMethod | string;
    productionCycle?: ExcelProductionCycle | string;
    stockQuantity?: number | string;
    sampleAvailability?: string;
    pricePerMeter?: number | string;
    minimumOrderQuantity?: number | string;
    leadTimeDays?: number | string;
    city?: string;
    locationState?: string;
    description?: string;
    fabricCollectionName?: string;
    materialPurity?: ExcelMaterialPurity;
    blendDescription?: string;
    finishOptions?: string[];
    imageUrl?: string;
}

export type ExcelCatalogRowStatus = "ready" | "attention" | "invalid";

export interface ExcelRowIssue {
    field: keyof ExcelCatalogRowMapped | "general";
    message: string;
    severity: "error" | "warning";
}

export interface ExcelCellMeta {
    originalRaw?: unknown;
    isRange?: boolean;
    rangeText?: string;
    detectedUnit?: string;
    normalizedValue?: unknown;
    min?: number;
    max?: number;
    displayValue?: string;
    interpretation?: string;
}

export interface ExcelCatalogRowValidated {
    id: string;
    rowNumber: number;
    data: ExcelCatalogRowMapped;
    status: ExcelCatalogRowStatus;
    statusLabel: string;
    issues: ExcelRowIssue[];
    cellMeta?: Record<string, ExcelCellMeta>;
    isDuplicateInFile?: boolean;
    isExistingInCatalog?: boolean;
}

export interface ExcelImportSummary {
    totalRows: number;
    readyCount: number;
    issuesCount: number;
}

export interface ExcelImportFailure {
    sourceSheet?: string;
    clientRowId?: string;
    rowNumber: number;
    fabricName?: string;
    reason: string;
}

export interface ExcelImportBatchResult {
    totalRows: number;
    importedCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    failures: ExcelImportFailure[];
    skipped: ExcelImportFailure[];
}

export type MappingConfidence = "matched" | "review" | "unmapped";

export interface DetectedColumn {
    index: number;
    rawHeader: string;
    cleanHeader: string;
    sampleValues: string[];
}

export interface FieldMappingSuggestion {
    targetFieldKey: keyof ExcelCatalogRowMapped;
    targetLabel: string;
    required: boolean;
    supplierColumnIndex: number | null; // null if unmapped
    supplierColumnName: string | null;
    confidence: MappingConfidence;
    confidenceReason?: string;
}

export interface HeaderRowCandidate {
    index: number; // 0-indexed
    displayRowNumber: number; // 1-indexed
    preview: string;
    score: number;
    columnCount: number;
}

export interface WorkbookAnalysisResult {
    sheets: string[];
    selectedSheet: string;
    totalRowsInSheet: number;
    detectedHeaderRowIndex: number; // 0-indexed
    candidateHeaderRows: HeaderRowCandidate[];
    columns: DetectedColumn[];
    mappings: FieldMappingSuggestion[];
    unmappedColumns: DetectedColumn[];
    samplePreviewRows: unknown[][];
}

export interface ExcelStagedRow extends ExcelCatalogRowValidated {
    originalData: ExcelCatalogRowMapped;
    sourceSheet?: string;
    sourceRowNumber?: number;
    rawCells?: unknown[];
    defaultedFields?: string[];
    cellMeta?: Record<string, ExcelCellMeta>;
    customFields: Record<string, unknown>;
    originalCustomFields: Record<string, unknown>;
    editedFields: string[];
    isEdited: boolean;
    isManuallyAdded?: boolean;
}

