import { parseNumericRange } from "./range-parser";
import type { ExcelCatalogRowMapped, ExcelRowIssue } from "./row-types";

export const OUNCES_PER_SQUARE_YARD_TO_GSM = 28.349523125 / (0.9144 ** 2);
const present = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== "";

export function detectWeightUnit(value: string): ExcelCatalogRowMapped["weightUnit"] {
    if (/(?:\b|(?<=\d))glm\b|grams?\s*per\s*linear|g\s*\/\s*(?:lm|linear\s*m)\b/i.test(value)) return "GLM";
    if (/(?:\b|(?<=\d))oz\b|ounces?/i.test(value)) return "OZ";
    if (/(?:\b|(?<=\d))gsm\b|g\s*\/\s*m[²2]/i.test(value)) return "GSM";
}

export function detectWidthUnit(value: string): ExcelCatalogRowMapped["widthUnit"] {
    if (/(?:\b|(?<=\d))cm\b|centimet(?:er|re)s?/i.test(value)) return "cm";
    if (/(?:\b|(?<=\d))in(?:ch(?:es)?)?\b|["″]/i.test(value)) return "inches";
}

export function stripDimensionUnit(value: unknown) {
    return typeof value === "string" ? value
        .replace(/g\s*\/\s*m[²2]|(?:\b|(?<=\d))(?:gsm|glm|oz|inches|inch|in|cm)\b|["″]/gi, "")
        .replace(/\s*\/\s*(?:yd[²2]|sq\.?\s*yd)(?:\b|$)/gi, "").trim() : value;
}

export function mapDimensionCell(key: "weightValue" | "widthValue", value: unknown, header: string): Partial<ExcelCatalogRowMapped> {
    const detect = key === "weightValue" ? detectWeightUnit : detectWidthUnit;
    const cellUnit = detect(String(value));
    const headerUnit = detect(header);
    const unit = cellUnit ?? headerUnit;
    const conflict = cellUnit && headerUnit && cellUnit !== headerUnit
        ? `Cell unit ${cellUnit} conflicts with header unit ${headerUnit}. Choose the correct unit explicitly.` : undefined;
    if (key === "weightValue") return {
        weightValue: stripDimensionUnit(value) as string | number,
        weightUnit: unit as ExcelCatalogRowMapped["weightUnit"],
        ...(conflict ? { unitConflicts: { weight: conflict } } : {}),
    };
    return {
        widthValue: stripDimensionUnit(value) as string | number,
        widthUnit: unit as ExcelCatalogRowMapped["widthUnit"],
        ...(conflict ? { unitConflicts: { width: conflict } } : {}),
    };
}

export function normalizeDimensions(data: ExcelCatalogRowMapped) {
    const issues: ExcelRowIssue[] = [];
    const add = (field: ExcelRowIssue["field"], message: string) => issues.push({ field, message, severity: "error" });
    // Presence, rather than truthiness, distinguishes a legacy field from an explicitly cleared editor value.
    const weightRaw = data.weightValue !== undefined ? data.weightValue : data.gsm;
    const widthRaw = data.widthValue !== undefined ? data.widthValue : data.widthInches;
    const enteredWeightUnit = detectWeightUnit(String(weightRaw ?? ""));
    const enteredWidthUnit = detectWidthUnit(String(widthRaw ?? ""));
    const weightUnit = data.weightUnit ?? enteredWeightUnit ?? (data.weightValue === undefined && present(data.gsm) ? "GSM" : undefined);
    const widthUnit = data.widthUnit ?? enteredWidthUnit ?? (data.widthValue === undefined && present(data.widthInches) ? "inches" : undefined);
    const weight = parseNumericRange(stripDimensionUnit(weightRaw), { domain: "gsm" });
    const width = parseNumericRange(stripDimensionUnit(widthRaw), { domain: "width" });
    const weightValue = weight.normalizedValue === null ? null : Math.round(weight.normalizedValue * 100) / 100;
    const widthValue = width.normalizedValue === null ? null : Math.round(width.normalizedValue * 100) / 100;
    const unitConflicts = { ...data.unitConflicts };
    if (weight.isInvertedRange) add("weightValue", "Inverted weight range: minimum cannot exceed maximum.");
    else if (!weightValue || weightValue <= 0) add("weightValue", "Weight must be a positive value or ascending range.");
    if (!widthValue || widthValue <= 0 || width.isInvertedRange) add("widthValue", "Width must be a positive value or ascending range.");
    if (weightUnit && !["GSM", "OZ", "GLM"].includes(weightUnit)) add("weightUnit", "Choose GSM, OZ, or GLM.");
    if (widthUnit && !["inches", "cm"].includes(widthUnit)) add("widthUnit", "Choose inches or cm.");
    if (data.unitConflicts?.weight) add("weightUnit", data.unitConflicts.weight);
    if (data.unitConflicts?.width) add("widthUnit", data.unitConflicts.width);
    if (enteredWeightUnit && data.weightUnit && enteredWeightUnit !== data.weightUnit) {
        unitConflicts.weight = "Entered weight unit conflicts with the selected unit. Choose the correct unit explicitly.";
        add("weightUnit", unitConflicts.weight);
    }
    if (enteredWidthUnit && data.widthUnit && enteredWidthUnit !== data.widthUnit) {
        unitConflicts.width = "Entered width unit conflicts with the selected unit. Choose the correct unit explicitly.";
        add("widthUnit", unitConflicts.width);
    }
    const widthInches = widthValue && widthValue > 0 && !width.isInvertedRange && (widthUnit === "cm" || widthUnit === "inches")
        ? widthUnit === "cm" ? widthValue / 2.54 : widthValue : undefined;
    if (widthInches && Math.round(widthInches * 100) <= 0) add("widthValue", "Converted width is too small for the catalog precision.");
    if ((weightValue && weightValue > 999999.99) || (widthValue && widthValue > 999999.99)) add("general", "Source dimensions exceed the catalog's supported precision.");
    const validGlmWidth = widthInches && widthValue && widthValue <= 999999.99 &&
        !issues.some(issue => issue.field === "widthValue" || issue.field === "widthUnit");
    let gsm: number | undefined;
    if (weightValue && weightUnit === "GSM") gsm = weightValue;
    if (weightValue && weightUnit === "OZ") {
        // OZ means ounces per square yard by importer convention; retain the source OZ scalar.
        if (weightValue > 0 && weightValue <= 999999.99 &&
            !issues.some(issue => issue.field === "weightValue" || issue.field === "weightUnit")) gsm = weightValue * OUNCES_PER_SQUARE_YARD_TO_GSM;
    }
    if (weightValue && weightUnit === "GLM") {
        if (!widthUnit) add("widthUnit", "Confirm the width unit before calculating GSM from GLM.");
        // GLM uses the entered full fabric width by importer convention; no per-row confirmation.
        if (validGlmWidth && weightValue > 0 && weightValue <= 999999.99 &&
            !issues.some(issue => issue.field === "weightValue" || issue.field === "weightUnit")) gsm = weightValue / (widthInches * 0.0254);
    }
    if (gsm !== undefined && (Math.round(gsm) <= 0 || gsm > 2147483647)) add("weightValue", "Converted GSM is outside the positive whole-number catalog range.");
    return {
        weightUnit, widthUnit, unitConflicts, weightValue: weightValue === null || weight.isInvertedRange ? weightRaw : Math.round(weightValue * 100) / 100,
        widthValue: widthValue === null || width.isInvertedRange ? widthRaw : Math.round(widthValue * 100) / 100,
        gsm: gsm ? Math.round(gsm) : undefined,
        widthInches: widthInches ? Math.round(widthInches * 100) / 100 : undefined,
        issues, weight, width,
    };
}
