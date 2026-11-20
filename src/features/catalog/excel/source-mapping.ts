import type { ExcelCatalogRowMapped, FieldMappingSuggestion } from "./row-types";
import { isShadeColumn, TARGET_CATALOG_FIELDS } from "./fields";
import { mapDimensionCell } from "./units";

export function mapSourceRow(raw: unknown[], headers: unknown[], mappings: Array<
    Pick<FieldMappingSuggestion, "targetFieldKey" | "supplierColumnIndex"> & Partial<FieldMappingSuggestion>>) {
    const data: ExcelCatalogRowMapped = {};
    const sources: ExcelCatalogRowMapped = {};
    for (const mapping of mappings) {
        if (!TARGET_CATALOG_FIELDS.some(field => field.key === mapping.targetFieldKey)) continue;
        const index = mapping.supplierColumnIndex;
        if (index === null || (mapping.confidence && mapping.confidence !== "matched")) continue;
        const header = String(headers[index] ?? mapping.supplierColumnName ?? "");
        const value = raw[index];
        if (mapping.targetFieldKey === "fabricName" && isShadeColumn(header)) continue;
        if (value === undefined || value === null || String(value).trim() === "") continue;
        if (["weightGlm", "countWarp", "countWeft"].includes(mapping.targetFieldKey)) {
            Object.assign(sources, { [mapping.targetFieldKey]: value });
        } else if (mapping.targetFieldKey === "weightValue" || mapping.targetFieldKey === "widthValue") {
            const mapped = mapDimensionCell(mapping.targetFieldKey, value, header);
            const conflicts = { ...data.unitConflicts, ...mapped.unitConflicts };
            Object.assign(data, mapped, { unitConflicts: conflicts });
        } else if (mapping.targetFieldKey === "finishOptions") {
            data.finishOptions = String(value).split(/[,;]/).map(item => item.trim()).filter(Boolean);
        } else {
            Object.assign(data, { [mapping.targetFieldKey]: typeof value === "string" ? value.trim() : value });
        }
    }
    const present = (value: unknown) => String(value ?? "").trim() !== "";
    if (!present(data.count)) {
        const parts = [["Warp", sources.countWarp], ["Weft", sources.countWeft]]
            .filter(([, value]) => present(value)).map(([direction, value]) => `${direction}: ${String(value).trim()}`);
        if (parts.length) data.count = parts.join(" / ");
    }
    // A supplied primary weight (including invalid/zero values) must be reviewed as supplied.
    if (!present(data.weightValue) && !present(data.gsm) && present(sources.weightGlm)) {
        Object.assign(data, mapDimensionCell("weightValue", sources.weightGlm, "GLM"));
    }
    return data;
}
