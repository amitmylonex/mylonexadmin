import {
    type DetectedColumn,
    type ExcelCatalogRowMapped,
    type FieldMappingSuggestion,
    type MappingConfidence,
} from "./types";
import { scoreColumnSemantics } from "./semantic";

import { TARGET_CATALOG_FIELDS, isShadeColumn } from "./fields";
export { TARGET_CATALOG_FIELDS, MAPPING_TARGET_OPTIONS } from "./fields";
export function suggestFieldMappings(columns: DetectedColumn[]): {
    mappings: FieldMappingSuggestion[];
    unmappedColumns: DetectedColumn[];
} {
    const assignedFields = new Set<keyof ExcelCatalogRowMapped>();
    const assignedColumns = new Set<number>();
    const fieldMappingResults = new Map<keyof ExcelCatalogRowMapped, FieldMappingSuggestion>();

    // Helper to normalize strings
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_\-\(\)\/\.\+\#\:\*&]/g, "");

    // Track available columns
    let availableColumns = [...columns];

    // STEP 1 & 2 & 3 & 4 & 5: Exact & Normalized Exact Match
    for (const field of TARGET_CATALOG_FIELDS) {
        const normFieldLabel = normalize(field.label);
        
        let matchCol = availableColumns.find(col => !assignedColumns.has(col.index) && !(field.key === "fabricName" && isShadeColumn(col.rawHeader)) && col.rawHeader.trim() === field.label); // exact
        if (!matchCol) {
            matchCol = availableColumns.find(col => !assignedColumns.has(col.index) && !(field.key === "fabricName" && isShadeColumn(col.rawHeader)) && normalize(col.rawHeader) === normFieldLabel); // norm exact
        }
        
        if (matchCol) {
            assignedFields.add(field.key);
            assignedColumns.add(matchCol.index);
            fieldMappingResults.set(field.key, {
                targetFieldKey: field.key,
                targetLabel: field.label,
                required: field.required,
                supplierColumnIndex: matchCol.index,
                supplierColumnName: matchCol.rawHeader,
                confidence: "matched",
                confidenceReason: "Exact header match",
            });
        }
    }

    // Refresh available columns
    availableColumns = columns.filter(c => !assignedColumns.has(c.index));

    // STEP 6: Explicit canonical aliases
    for (const field of TARGET_CATALOG_FIELDS) {
        if (assignedFields.has(field.key)) continue; // Already mapped

        let matchCol = availableColumns.find(col => {
            if (assignedColumns.has(col.index) || (field.key === "fabricName" && isShadeColumn(col.rawHeader))) return false;
            const normHeader = normalize(col.rawHeader);
            return field.aliases.some(alias => normalize(alias) === normHeader);
        });

        if (matchCol) {
            assignedFields.add(field.key);
            assignedColumns.add(matchCol.index);
            fieldMappingResults.set(field.key, {
                targetFieldKey: field.key,
                targetLabel: field.label,
                required: field.required,
                supplierColumnIndex: matchCol.index,
                supplierColumnName: matchCol.rawHeader,
                confidence: "matched",
                confidenceReason: "Canonical alias match",
            });
        }
    }

    // Refresh available columns
    availableColumns = columns.filter(c => !assignedColumns.has(c.index));

    // STEP 7: Semantic matching for remaining
    interface CandidateMatch {
        fieldKey: keyof ExcelCatalogRowMapped;
        fieldLabel: string;
        required: boolean;
        columnIndex: number;
        columnName: string;
        score: number;
        confidence: MappingConfidence;
        reason?: string;
    }

    const candidateMatches: CandidateMatch[] = [];

    for (const field of TARGET_CATALOG_FIELDS) {
        if (assignedFields.has(field.key)) continue;

        // Weave requires an explicit header or confirmed source mapping; never infer from other values.
        if (field.key === "weaveType") continue;

        for (const col of availableColumns) {
            if (field.key === "fabricName" && isShadeColumn(col.rawHeader)) continue;
            const semanticResult = scoreColumnSemantics(col, field);
            if (semanticResult.headerScore > 0 && semanticResult.confidence !== "unmapped" && semanticResult.totalScore >= 0.5) {
                candidateMatches.push({
                    fieldKey: field.key,
                    fieldLabel: field.label,
                    required: field.required,
                    columnIndex: col.index,
                    columnName: col.rawHeader,
                    score: semanticResult.totalScore,
                    confidence: semanticResult.confidence,
                    reason: semanticResult.reason,
                });
            }
        }
    }

    // Sort candidate matches highest score first
    candidateMatches.sort((a, b) => b.score - a.score);

    // Greedily assign best semantic matches
    for (const match of candidateMatches) {
        if (!assignedFields.has(match.fieldKey) && !assignedColumns.has(match.columnIndex)) {
            assignedFields.add(match.fieldKey);
            assignedColumns.add(match.columnIndex);
            fieldMappingResults.set(match.fieldKey, {
                targetFieldKey: match.fieldKey,
                targetLabel: match.fieldLabel,
                required: match.required,
                supplierColumnIndex: match.columnIndex,
                supplierColumnName: match.columnName,
                confidence: match.confidence,
                confidenceReason: match.reason || "Semantic fuzzy match",
            });
        }
    }

    // Build the final full list of target field mappings
    const finalMappings: FieldMappingSuggestion[] = TARGET_CATALOG_FIELDS.map((field) => {
        const existing = fieldMappingResults.get(field.key);
        if (existing) {
            return existing;
        }

        return {
            targetFieldKey: field.key,
            targetLabel: field.label,
            required: field.required,
            supplierColumnIndex: null,
            supplierColumnName: null,
            confidence: "unmapped",
            confidenceReason: "No matching column found in uploaded file",
        };
    });

    // Retain unresolved headers for explicit remapping, never create review columns.
    const unmappedSupplierColumns = columns.filter((col) => !assignedColumns.has(col.index));

    return {
        mappings: finalMappings,
        unmappedColumns: unmappedSupplierColumns,
    };
}

