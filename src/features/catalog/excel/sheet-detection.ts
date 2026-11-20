import type { DetectedColumn, HeaderRowCandidate } from "./row-types";
import { TARGET_CATALOG_FIELDS } from "./fields";
export function detectHeaderRow(rawRows: unknown[][]): {
    detectedIndex: number;
    candidates: HeaderRowCandidate[];
} {
    if (!rawRows || rawRows.length === 0) {
        return { detectedIndex: 0, candidates: [] };
    }

    const maxRowsToInspect = Math.min(rawRows.length, 100);
    const candidates: HeaderRowCandidate[] = [];

    // Collect all known alias tokens to score headers against
    const allKnownTokens = new Set<string>();
    for (const field of TARGET_CATALOG_FIELDS) {
        for (const a of field.aliases) {
            allKnownTokens.add(a.toLowerCase().replace(/[\s_\-\(\)\/]/g, ""));
        }
    }

    for (let r = 0; r < maxRowsToInspect; r++) {
        const row = rawRows[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        let nonEmptyCount = 0;
        let stringCount = 0;
        let aliasMatchCount = 0;
        const cellValues: string[] = [];

        for (const cell of row) {
            const val = String(cell ?? "").trim();
            if (val !== "") {
                nonEmptyCount++;
                cellValues.push(val);

                if (isNaN(Number(val))) {
                    stringCount++;
                }

                const norm = val.toLowerCase().replace(/[\s_\-\(\)\/]/g, "");
                for (const token of allKnownTokens) {
                    if (norm === token || (norm.length >= 3 && norm.includes(token))) {
                        aliasMatchCount++;
                        break;
                    }
                }
            }
        }

        if (nonEmptyCount === 0) continue;

        const uniqueValuesCount = new Set(cellValues.map((v) => v.toLowerCase())).size;
        const uniquenessRatio = uniqueValuesCount / nonEmptyCount;

        // Check if rows below contain data
        let rowsBelowWithData = 0;
        for (let b = r + 1; b < Math.min(rawRows.length, r + 5); b++) {
            const belowRow = rawRows[b];
            if (Array.isArray(belowRow) && belowRow.some((c) => String(c ?? "").trim() !== "")) {
                rowsBelowWithData++;
            }
        }

        // Score formulation
        // - Heavy weight on known alias matches
        // - High weight on text/string density (headers are text, data often has numbers)
        // - High weight on distinctness (column names are unique)
        // - High weight on presence of data rows below
        let score = 0;
        score += aliasMatchCount * 25;
        score += (stringCount / nonEmptyCount) * 20;
        score += uniquenessRatio * 15;
        score += nonEmptyCount >= 3 ? 15 : nonEmptyCount * 4;
        score += rowsBelowWithData * 5;

        // Penalty if mostly numbers
        if (stringCount / nonEmptyCount < 0.3) {
            score -= 30;
        }

        const preview = cellValues.slice(0, 5).join(" | ");

        candidates.push({
            index: r,
            displayRowNumber: r + 1,
            preview: preview || `Row ${r + 1}`,
            score: Math.max(0, Math.round(score)),
            columnCount: nonEmptyCount,
        });
    }

    if (candidates.length === 0) {
        return { detectedIndex: 0, candidates: [] };
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    const bestIndex = candidates[0].index;

    // Return candidates sorted by row order for user dropdown selection
    const sortedByRow = [...candidates].sort((a, b) => a.index - b.index);

    return {
        detectedIndex: bestIndex,
        candidates: sortedByRow,
    };
}

/**
 * Extracts columns and representative sample values from raw rows given a header row index.
 */
export function extractColumnsFromSheet(
    rawRows: unknown[][],
    headerRowIndex: number
): DetectedColumn[] {
    if (!rawRows || headerRowIndex >= rawRows.length) return [];

    const headerRow = rawRows[headerRowIndex] || [];
    const maxCols = headerRow.length;
    const columns: DetectedColumn[] = [];

    for (let c = 0; c < maxCols; c++) {
        const rawCell = headerRow[c];
        const rawHeader = String(rawCell ?? "").trim();
        const fallbackName = `Column ${String.fromCharCode(65 + (c % 26))}${c >= 26 ? Math.floor(c / 26) : ""}`;
        const cleanHeader = rawHeader || fallbackName;

        // Sample up to 4 non-empty values below the header row
        const samples: string[] = [];
        for (let r = headerRowIndex + 1; r < Math.min(rawRows.length, headerRowIndex + 10); r++) {
            const dataRow = rawRows[r];
            if (Array.isArray(dataRow)) {
                const sampleVal = String(dataRow[c] ?? "").trim();
                if (sampleVal !== "" && !samples.includes(sampleVal)) {
                    samples.push(sampleVal);
                    if (samples.length >= 3) break;
                }
            }
        }

        columns.push({
            index: c,
            rawHeader: cleanHeader,
            cleanHeader,
            sampleValues: samples,
        });
    }

    return columns;
}

