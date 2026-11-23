import type { ExcelCatalogRowMapped } from "./row-types.js";
import { TARGET_CATALOG_FIELDS, CATALOG_EDITOR_FIELDS, isShadeColumn } from "./fields.js";
import { getFieldRequirement } from "./requirements.js";
export interface ExcelColumnDefinition {
    key: keyof ExcelCatalogRowMapped; header: string; required: boolean; example: string | number; description: string; allowedValues?: readonly string[];
}
const EXAMPLES: Partial<Record<keyof ExcelCatalogRowMapped, string | number>> = {
    fabricName: "Organic Cotton Poplin 40s", composition: "100% Combed Cotton",
    weightValue: 120, widthValue: 58, count: "40 x 40", construction: "60 x 80", weaveType: "1/1 Plain", fabricState: "greige",
    productionCycle: "made-to-order", stockQuantity: 0, pricePerMeter: 185.5, minimumOrderQuantity: 1000,
    leadTimeDays: 21, sampleAvailability: "Yes", fabricCollectionName: "Spring Essentials 2026",
};
export const EXCEL_CATALOG_COLUMNS: ExcelColumnDefinition[] = CATALOG_EDITOR_FIELDS.map(field => ({
    key: field.key, header: field.key === "weightValue" ? "GSM" : field.key === "widthValue" ? "Width (inches)" : field.label,
    required: getFieldRequirement(field.key).isRequired, example: EXAMPLES[field.key] ?? "",
    description: field.key === "yarnType" ? "Requires a separate catalog storage decision; do not populate for Phase 1." : field.description,
    allowedValues: field.options,
}));
const normalize = (header: string) => header.toLowerCase().replace(/[\s_\-()\/.*+#:&]/g, "");
/** Legacy callers use the same registry as the active workbook analyzer. */
export function normalizeHeader(rawHeader: string): keyof ExcelCatalogRowMapped | null {
    if (!rawHeader || isShadeColumn(rawHeader)) return null;
    const header = normalize(rawHeader);
    return TARGET_CATALOG_FIELDS.find(field => [field.label, field.key, ...field.aliases].some(alias => normalize(alias) === header))?.key ?? null;
}
