import { EXCEL_ALLOWED_DYE_METHODS, EXCEL_ALLOWED_FABRIC_STATES } from "./allowed-values.js";
import type { ExcelCatalogRowMapped, ExcelCatalogRowValidated, ExcelRowIssue } from "./row-types.js";
import { normalizeLeadTime, normalizeMoq, normalizePrice, normalizeProductionCycle } from "./semantic.js";
import { importWeaveTextSchema } from "./weave-text.js";
import { normalizeDimensions } from "./units.js";
import { getProposedDefaults } from "./fields.js";
export { getFieldRequirement } from "./requirements.js";

const text = (v: unknown) => String(v ?? "").trim();

export function validateExcelRow(data: ExcelCatalogRowMapped, rowIndex: number,
    existingCatalogNames: Set<string> = new Set(), originalData?: ExcelCatalogRowMapped): ExcelCatalogRowValidated {
    const issues: ExcelRowIssue[] = [];
    const error = (field: ExcelRowIssue["field"], message: string) => issues.push({ field, message, severity: "error" });
    const dimensions = normalizeDimensions(data);
    issues.push(...dimensions.issues);
    const normalized: ExcelCatalogRowMapped = {
        ...data, fabricName: text(data.fabricName),
        weightUnit: dimensions.weightUnit, weightValue: dimensions.weightValue,
        widthUnit: dimensions.widthUnit, widthValue: dimensions.widthValue,
        gsm: dimensions.gsm, widthInches: dimensions.widthInches,
        unitConflicts: dimensions.unitConflicts,
    };
    // Removed importer fields never participate in validation or downstream creation.
    delete normalized.fabricType; delete normalized.materialPurity; delete normalized.blendDescription;
    for (const field of ["composition", "count", "construction", "yarnType", "city", "locationState", "description", "fabricCollectionName", "sampleAvailability"] as const) {
        normalized[field] = data[field] === undefined ? undefined : text(data[field]);
    }
    if (!text(data.composition)) error("composition", "Blend & Composition is required.");
    if (!text(data.count) && !text(data.construction)) {
        error("count", "Count or construction is required."); error("construction", "Count or construction is required.");
    }
    if (!text(data.sampleAvailability)) error("sampleAvailability", "Sample availability is required.");
    if (text(data.yarnType)) error("yarnType", "Yarn Type has no catalog storage field yet. Keep it in staging, or explicitly copy it into Buyer Notes and clear this field. A separate schema decision is required.");
    const weave = importWeaveTextSchema.safeParse(data.weaveType ?? "");
    normalized.weaveType = text(data.weaveType);
    if (weave.success) normalized.weaveType = weave.data;
    else for (const issue of weave.error.issues) error("weaveType", issue.message);
    if (text(data.productionCycle)) {
        normalized.productionCycle = normalizeProductionCycle(data.productionCycle) ?? data.productionCycle;
        if (!normalizeProductionCycle(data.productionCycle)) error("productionCycle", `Invalid production cycle '${data.productionCycle}'.`);
    }
    if (text(data.fabricState)) {
        normalized.fabricState = text(data.fabricState).toLowerCase();
        if (!EXCEL_ALLOWED_FABRIC_STATES.includes(normalized.fabricState as typeof EXCEL_ALLOWED_FABRIC_STATES[number])) error("fabricState", "Choose greige, rfd, dyed, or printed.");
    }
    if (text(data.dyeMethod)) {
        normalized.dyeMethod = text(data.dyeMethod).replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/[ -]+/g, "_");
        if (!EXCEL_ALLOWED_DYE_METHODS.includes(normalized.dyeMethod as typeof EXCEL_ALLOWED_DYE_METHODS[number])) error("dyeMethod", "Choose yarn_dyed or piece_dyed.");
    }
    if (normalized.fabricState === "dyed" && !text(normalized.dyeMethod)) issues.push({ field: "dyeMethod", message: "Dye method is required when Fabric State is dyed.", severity: "warning" });
    const stock = text(data.stockQuantity);
    if (stock) {
        const quantity = Number(stock);
        if (!Number.isInteger(quantity) || quantity < 0) error("stockQuantity", "Stock must be a non-negative whole number.");
        else normalized.stockQuantity = quantity;
    }
    if (normalized.productionCycle === "ready-stock" && (!stock || Number(stock) <= 0)) error("stockQuantity", "Stock quantity must be greater than 0 for Ready Stock.");
    const price = normalizePrice(data.pricePerMeter);
    if (!price.numeric) error("pricePerMeter", "Price per meter must be a positive number; missing source prices require correction.");
    else normalized.pricePerMeter = price.numeric;
    const moq = normalizeMoq(data.minimumOrderQuantity);
    if (text(data.minimumOrderQuantity)) {
        if (moq.isInvertedRange) error("minimumOrderQuantity", "Inverted MOQ range: minimum cannot exceed maximum.");
        else if (!moq.min || !Number.isInteger(moq.min)) error("minimumOrderQuantity", "MOQ must be a positive whole number or ascending range. Mixed total/per-shade quantities require an explicit correction.");
        else normalized.minimumOrderQuantity = moq.min;
    }
    const lead = normalizeLeadTime(data.leadTimeDays);
    if (text(data.leadTimeDays)) {
        if (!lead.normalized || lead.isInvertedRange) error("leadTimeDays", "Lead time must be positive or an ascending range.");
        else normalized.leadTimeDays = lead.normalized;
    }
    const image = text(data.imageUrl);
    if (image) {
        try { const url = new URL(image); if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol"); }
        catch { error("imageUrl", "Image URL must be a valid http:// or https:// URL."); }
        if (normalized.fabricState === "dyed" || normalized.fabricState === "printed") error("imageUrl", "This image needs a shade association. Excel shade import is not supported yet. Add the image to a shade card in the manual editor, or clear the import image explicitly.");
    }
    if (data.finishOptions?.some(value => !text(value) || value === "___CUSTOM___")) error("finishOptions", "Enter the actual finish name.");
    for (const [key, value] of getProposedDefaults(normalized)) issues.push({ field: key as keyof ExcelCatalogRowMapped,
        message: `Not supplied. Proposed default: ${value}. Confirm the default or enter a value.`, severity: "warning" });
    const isExistingInCatalog = Boolean(normalized.fabricName && existingCatalogNames.has(normalized.fabricName.toLowerCase()));
    if (isExistingInCatalog) issues.push({ field: "fabricName", message: "Name exists. The server skips an exact name + weave + GSM match; otherwise it creates a listing.", severity: "warning" });
    const blocking = issues.filter(issue => !issue.message.startsWith("Name exists."));
    const status = blocking.some(issue => issue.severity === "error") ? "invalid" : blocking.length ? "attention" : "ready";
    const cellMeta: ExcelCatalogRowValidated["cellMeta"] = {};
    for (const [key, parsed, canonical, unit] of [
        ["weightValue", dimensions.weight, normalized.gsm, "GSM"],
        ["widthValue", dimensions.width, normalized.widthInches, "inches"],
        ["minimumOrderQuantity", moq, moq.min, "meters"],
        ["leadTimeDays", lead, lead.normalized, "days"],
    ] as const) {
        const field = key as keyof ExcelCatalogRowMapped;
        const legacy = key === "weightValue" ? "gsm" : key === "widthValue" ? "widthInches" : field;
        cellMeta[key] = { originalRaw: originalData?.[field] ?? originalData?.[legacy] ?? data[field] ?? data[legacy], normalizedValue: canonical,
            isRange: parsed.isRange, min: parsed.min ?? undefined, max: parsed.max ?? undefined,
            displayValue: String(canonical ?? ""), rangeText: parsed.isRange ? String(originalData?.[field] ?? data[field]) : undefined,
            detectedUnit: unit, interpretation: `Catalog stores ${canonical ?? "unresolved"} ${unit}. Source ranges use the existing scalar rule.` };
    }
    cellMeta.gsm = cellMeta.weightValue; cellMeta.widthInches = cellMeta.widthValue;
    cellMeta.pricePerMeter = { originalRaw: originalData?.pricePerMeter ?? data.pricePerMeter, normalizedValue: price.numeric ?? undefined, displayValue: price.formatted, detectedUnit: "INR", interpretation: price.numeric ? `Wholesale price ₹${price.numeric} per meter` : undefined };
    return { id: `row-${rowIndex}`, rowNumber: rowIndex, data: normalized, status,
        statusLabel: status === "ready" ? "✓ Ready" : status === "invalid" ? "✕ Invalid" : "⚠ Needs Attention", issues, cellMeta, isExistingInCatalog };
}

export function catalogSignature(data: ExcelCatalogRowMapped) {
    return `${text(data.fabricName).toLowerCase()}|${text(data.weaveType).toLowerCase()}|${data.gsm ?? ""}`;
}

export function detectAndMarkBatchDuplicates<T extends ExcelCatalogRowValidated>(rows: T[]): T[] {
    const seen = new Set<string>();
    return rows.map(row => {
        const signature = catalogSignature(row.data);
        const duplicate = seen.has(signature);
        seen.add(signature);
        return { ...row, isDuplicateInFile: duplicate, issues: [
            ...row.issues.filter(issue => !issue.message.startsWith("Duplicate fabric in file")),
            ...(duplicate ? [{ field: "fabricName" as const, severity: "warning" as const,
                message: "Duplicate fabric in file: skipped if an earlier matching row is saved successfully." }] : []),
        ] };
    });
}
