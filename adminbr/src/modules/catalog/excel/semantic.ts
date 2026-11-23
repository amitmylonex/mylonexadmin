import {
    type DetectedColumn,
    type MappingConfidence,
} from "./types.js";
import {
    SUPPLIER_PRODUCTION_CYCLES,
    SUPPLIER_WEAVE_TYPES,
} from "../constants.js";
import { type TargetFieldConfig } from "./fields.js";
import { parseNumericRange } from "./range-parser.js";

export interface NormalizedPrice {
    numeric: number | null;
    original: string;
    formatted: string;
}

export interface NormalizedMoq {
    min: number | null;
    max: number | null;
    isRange: boolean;
    isInvertedRange?: boolean;
    isOpenEnded?: boolean;
    original: string;
    rangeText?: string;
    normalized: number;
}

export interface NormalizedGsm {
    min: number | null;
    max: number | null;
    isRange: boolean;
    isInvertedRange?: boolean;
    original: string;
    rangeText?: string;
    normalized: number | null;
    formatted: string;
}

export interface NormalizedWidth {
    min: number | null;
    max: number | null;
    isRange: boolean;
    isInvertedRange?: boolean;
    original: string;
    rangeText?: string;
    normalized: number | null;
    formatted: string;
}

export interface NormalizedLeadTime {
    min: number | null;
    max: number | null;
    isRange: boolean;
    isInvertedRange?: boolean;
    isOpenEnded?: boolean;
    unit: string | null;
    original: string;
    rangeText?: string;
    normalized: number | null;
    formatted: string;
}

export interface SemanticScoreBreakdown {
    headerScore: number;
    valuePatternScore: number;
    dataTypeScore: number;
    semanticScore: number;
    rangeScore: number;
    unitScore: number;
    totalScore: number;
    confidence: MappingConfidence;
    reason: string;
}

/**
 * Normalizes price values from diverse supplier representations:
 * "161/-", "₹161", "INR 250", "1,250/-", "161.50", "161", "161 per meter", etc.
 */
export function normalizePrice(rawVal: unknown): NormalizedPrice {
    const parsed = parseNumericRange(rawVal, { domain: "price", defaultUnit: "INR" });
    if (parsed.normalizedValue === null || parsed.normalizedValue <= 0) {
        return { numeric: null, original: parsed.rawValue, formatted: parsed.rawValue };
    }
    return {
        numeric: parsed.normalizedValue,
        original: parsed.rawValue,
        formatted: `₹${parsed.normalizedValue.toLocaleString("en-IN")}`,
    };
}

/**
 * Normalizes MOQ values from diverse supplier representations:
 * "10K-20K", "5K-10K", "1000-5000", "1,000 - 5,000", "1000", etc.
 */
export function normalizeMoq(rawVal: unknown): NormalizedMoq {
    const parsed = parseNumericRange(rawVal, { domain: "moq", defaultUnit: "meters" });
    if (parsed.min === null || parsed.min <= 0) {
        return {
            min: null,
            max: null,
            isRange: false,
            isInvertedRange: parsed.isInvertedRange,
            isOpenEnded: parsed.isOpenEnded,
            original: parsed.rawValue,
            normalized: 0,
        };
    }
    return {
        min: parsed.min,
        max: parsed.max ?? parsed.min,
        isRange: parsed.isRange,
        isInvertedRange: parsed.isInvertedRange,
        isOpenEnded: parsed.isOpenEnded,
        original: parsed.rawValue,
        rangeText: parsed.isRange ? parsed.rawValue : (parsed.isOpenEnded ? `${parsed.min.toLocaleString("en-IN")}+ meters` : undefined),
        normalized: parsed.min,
    };
}

/**
 * Normalizes GSM values with detailed range info.
 */
export function normalizeGsmDetailed(rawVal: unknown): NormalizedGsm {
    const parsed = parseNumericRange(rawVal, { domain: "gsm", defaultUnit: "GSM" });
    return {
        min: parsed.min,
        max: parsed.max,
        isRange: parsed.isRange,
        isInvertedRange: parsed.isInvertedRange,
        original: parsed.rawValue,
        rangeText: parsed.isRange ? parsed.displayValue : undefined,
        normalized:
            parsed.normalizedValue !== null && parsed.normalizedValue > 0
                ? Math.round(parsed.normalizedValue)
                : null,
        formatted: parsed.displayValue,
    };
}

/**
 * Normalizes GSM values to single integer:
 * "122", 122, "122 (+-5)", "122 gsm", "120-125 GSM", etc.
 */
export function normalizeGsm(rawVal: unknown): number | null {
    return normalizeGsmDetailed(rawVal).normalized;
}

/**
 * Normalizes width values with detailed range info.
 */
export function normalizeWidthDetailed(rawVal: unknown): NormalizedWidth {
    const parsed = parseNumericRange(rawVal, { domain: "width", defaultUnit: "inches" });
    return {
        min: parsed.min,
        max: parsed.max,
        isRange: parsed.isRange,
        isInvertedRange: parsed.isInvertedRange,
        original: parsed.rawValue,
        rangeText: parsed.isRange ? parsed.displayValue : undefined,
        normalized: parsed.normalizedValue,
        formatted: parsed.displayValue,
    };
}

/**
 * Normalizes width values:
 * 145, "145", "145\"", "145 inches", etc.
 */
export function normalizeWidth(rawVal: unknown): number | null {
    return normalizeWidthDetailed(rawVal).normalized;
}

/**
 * Normalizes lead time values to days with unit and range awareness:
 * "60 DAYS", "60-69 DAYS", "8 WEEKS", "2 MONTHS", 60, etc.
 */
export function normalizeLeadTime(rawVal: unknown): NormalizedLeadTime {
    const parsed = parseNumericRange(rawVal, { domain: "leadTime", defaultUnit: "days" });
    return {
        min: parsed.min,
        max: parsed.max,
        isRange: parsed.isRange,
        isInvertedRange: parsed.isInvertedRange,
        isOpenEnded: parsed.isOpenEnded,
        unit: parsed.unit,
        original: parsed.rawValue,
        rangeText: parsed.isRange ? parsed.displayValue : undefined,
        normalized:
            parsed.normalizedValue !== null && parsed.normalizedValue > 0
                ? Math.round(parsed.normalizedValue)
                : null,
        formatted: parsed.displayValue,
    };
}

/**
 * Detects whether a string specifies a knitted fabric structure rather than a woven weave.
 */
export function isKnittedStructure(rawVal: unknown): boolean {
    if (rawVal === null || rawVal === undefined) return false;
    const str = String(rawVal).trim().toLowerCase();
    if (!str) return false;

    return (
        /\b(knit|knitted|knits|knitting)\b/i.test(str) ||
        /\b(jersey|single jersey|rib|interlock|pique|fleece|french terry|spacer|lycra jersey)\b/i.test(str)
    );
}

/**
 * Normalizes weave values to canonical MyloNex woven weave enum:
 * "plain" | "twill" | "satin" | "dobby" | "jacquard" | "oxford" | "canvas" | "poplin"
 * Returns null for knitted structures or unrecognized weaves.
 */
export function normalizeWeave(rawVal: unknown): (typeof SUPPLIER_WEAVE_TYPES)[number] | null {
    if (rawVal === null || rawVal === undefined) return null;
    let str = String(rawVal).trim().toLowerCase();
    if (!str) return null;

    if (str.endsWith(" weave")) {
        str = str.replace(/\s+weave$/, "").trim();
    }

    // Knitted fabrics are structures, not woven weaves
    if (isKnittedStructure(str)) {
        return null;
    }

    // Exact matches
    if (str === "plain") return "plain";
    if (str === "poplin") return "poplin";
    if (str === "twill") return "twill";
    if (str === "satin") return "satin";
    if (str === "dobby") return "dobby";
    if (str === "jacquard") return "jacquard";
    if (str === "oxford") return "oxford";
    if (str === "canvas") return "canvas";

    // Poplin checked before generic plain synonyms
    if (str.includes("poplin")) {
        return "poplin";
    }

    // Common synonyms / sub-weaves for plain
    if (str.includes("plain") || str.includes("cambric") || str.includes("voile")) {
        return "plain";
    }

    // Twill variants (2/1, 3/1, herringbone, caviliar, drill, etc.)
    if (
        str.includes("twill") ||
        str.includes("drill") ||
        str.includes("herringbone") ||
        str.includes("caviliar") ||
        /\b[0-9]\/[0-9]\b/.test(str)
    ) {
        return "twill";
    }

    // Satin / Sateen
    if (str.includes("satin") || str.includes("sateen")) {
        return "satin";
    }

    // Dobby / Cord
    if (
        str.includes("dobby") ||
        str.includes("cord") ||
        str.includes("seersucker") ||
        str.includes("honey comb") ||
        str.includes("honeycomb") ||
        str.includes("honey-comb") ||
        str.includes("mindent") ||
        str.includes("misdent") ||
        str.includes("ripstop") ||
        str.includes("double cloth")
    ) {
        return "dobby";
    }

    // Jacquard
    if (str.includes("jacquard") || str.includes("brocade") || str.includes("damask")) {
        return "jacquard";
    }

    // Oxford
    if (str.includes("oxford")) {
        return "oxford";
    }

    // Canvas / Duck
    if (str.includes("canvas") || str.includes("duck")) {
        return "canvas";
    }

    return null;
}

/**
 * Normalizes production cycle values from diverse supplier representations:
 * "Ready Stock", "ready_stock", "ready-stock", "Running Production", "running",
 * "Made to Order", "made_to_order", "made-to-order", "make to order", etc.
 */
export function normalizeProductionCycle(rawVal: unknown): (typeof SUPPLIER_PRODUCTION_CYCLES)[number] | null {
    if (rawVal === null || rawVal === undefined) return null;
    const str = String(rawVal).trim().toLowerCase().replace(/[\s_-]+/g, " ");
    if (!str) return null;

    if (
        str === "ready-stock" ||
        str === "ready_stock" ||
        str === "ready stock" ||
        str === "ready" ||
        str === "in stock" ||
        str === "instock"
    ) {
        return "ready-stock";
    }

    if (
        str === "running-production" ||
        str === "running_production" ||
        str === "running production" ||
        str === "running" ||
        str === "regular production" ||
        str === "regular" ||
        str === "noos"
    ) {
        return "running-production";
    }

    if (
        str === "made-to-order" ||
        str === "made_to_order" ||
        str === "made to order" ||
        str === "make to order" ||
        str === "make-to-order" ||
        str === "make_to_order" ||
        str === "mto" ||
        str === "on order" ||
        str === "custom order"
    ) {
        return "made-to-order";
    }

    return null;
}

export type ValuePatternType =
    | "CURRENCY"
    | "QUANTITY_RANGE"
    | "CONSTRUCTION"
    | "WEAVE"
    | "FINISH_CODE"
    | "YARN_COUNT_COMPOSITION"
    | "NUMERIC"
    | "INTEGER"
    | "ALPHANUMERIC_CODE"
    | "TEXT"
    | "EMPTY";

/**
 * Detects the dominant semantic pattern of a single value.
 */
export function detectValuePattern(val: unknown): ValuePatternType {
    if (val === null || val === undefined) return "EMPTY";
    const str = String(val).trim();
    if (!str) return "EMPTY";

    // 1. Currency: e.g. "161/-", "₹161", "INR 250", "1,250/-"
    if (
        str.includes("/-") ||
        /[₹$€£]/.test(str) ||
        /\b(inr|rs|usd)\b/i.test(str) ||
        (/^[0-9,]+(?:\.[0-9]+)?$/.test(str) && str.includes(","))
    ) {
        return "CURRENCY";
    }

    // 2. Quantity Range: e.g. "10K-20K", "1000-5000", "5K-10K"
    if (/^[0-9.,]+\s*[KkMmLlAaKkHh]*\s*(?:-|–|—|to)\s*[0-9.,]+\s*[KkMmLlAaKkHh]*$/i.test(str)) {
        return "QUANTITY_RANGE";
    }

    // 3. Construction: e.g. "112*82", "164*82", "131*82", "84*72", "145*90", "110*92"
    // Characteristic <number>*<number> without fiber words
    if (/^[0-9]{2,3}\s*[\*xX]\s*[0-9]{2,3}$/.test(str)) {
        return "CONSTRUCTION";
    }

    // 4. Weave pattern: PLAIN, DOBBY, TWILL, SATIN, etc.
    if (
        /\b(plain|twill|satin|dobby|jacquard|oxford|canvas|poplin|cord|drill)\b/i.test(str) ||
        /[0-9]\/[0-9]\s*[sz]?\s*twill/i.test(str)
    ) {
        return "WEAVE";
    }

    // 5. Yarn Count / Fiber Blend / Composition:
    // e.g. "40*40 MODAL", "2/60CT*2/60CT+2/20OE", "30CM*20Spx 40D", "30VIS*30VORTEX.VIS", "100% COTTON"
    if (
        /(?:modal|vis|viscose|vortex|spx|spandex|cotton|poly|polyester|linen|silk|wool|oe|count|eco\.?vis|lenz)/i.test(
            str
        ) ||
        /[0-9]+\s*[a-z]*\s*[\*xX\/]\s*[0-9]+.*?[a-z]/i.test(str) ||
        /(?:[0-9]{1,3}%.*?[a-z]+)/i.test(str)
    ) {
        return "YARN_COUNT_COMPOSITION";
    }

    // 6. Finish code: e.g. "CM-ST", "TC-ST", "SCM-PDAST", "V-5JABXF", "TC-PST", "TCS-ST", "TC-PF"
    // Short uppercase alphanumeric codes with hyphens, not numeric, not natural sentences
    if (
        /^[A-Z0-9]{1,6}(?:-[A-Z0-9]{1,8})+$/i.test(str) ||
        /^(rfd|greige|dyed|bleach|mercerized|printed)$/i.test(str)
    ) {
        return "FINISH_CODE";
    }

    // 7. Pure integer: e.g. "122", "145", "1000"
    if (/^[0-9]+$/.test(str)) {
        return "INTEGER";
    }

    // 8. Number: e.g. "150.50"
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(str)) {
        return "NUMERIC";
    }

    // 9. Alphanumeric article code: e.g. "A140E055", "A260A404", "14500101"
    if (/^[A-Z0-9]{5,15}$/i.test(str)) {
        return "ALPHANUMERIC_CODE";
    }

    return "TEXT";
}

function normalizeToken(val: string): string {
    return val
        .trim()
        .toLowerCase()
        .replace(/[\s_\-\(\)\/\#\:\.\+]/g, "");
}

/**
 * Calculates semantic compatibility between a supplier column (header + samples)
 * and a target catalog field.
 */
export function scoreColumnSemantics(
    column: DetectedColumn,
    field: TargetFieldConfig
): SemanticScoreBreakdown {
    const rawHeader = column.rawHeader;
    const normHeader = normalizeToken(rawHeader);
    const samples = column.sampleValues;

    // Detect patterns across sample values
    const patterns = samples.map(detectValuePattern).filter((p) => p !== "EMPTY");

    // Count pattern occurrences
    const patternCounts = new Map<ValuePatternType, number>();
    for (const p of patterns) {
        patternCounts.set(p, (patternCounts.get(p) || 0) + 1);
    }
    const sampleTotal = Math.max(1, patterns.length);

    // 1. Header Score (0.0 to 1.0)
    let headerScore = 0;
    let headerReason = "";

    // Check exact alias match
    for (const alias of field.aliases) {
        const normAlias = normalizeToken(alias);
        if (normHeader === normAlias) {
            headerScore = 1.0;
            headerReason = `Header matches '${alias}'`;
            break;
        }
    }

    // Check token inclusion if not exact
    if (headerScore === 0) {
        for (const alias of field.aliases) {
            const normAlias = normalizeToken(alias);
            if (normHeader.length >= 3 && normAlias.length >= 3) {
                if (normHeader.includes(normAlias) || normAlias.includes(normHeader)) {
                    headerScore = 0.85;
                    headerReason = `Header closely contains '${alias}'`;
                    break;
                }
            }
        }
    }

    let isReviewAlias = false;
    // Check review aliases
    if (headerScore === 0 && field.reviewAliases) {
        for (const rev of field.reviewAliases) {
            const normRev = normalizeToken(rev);
            if (normHeader === normRev || (normHeader.length >= 4 && normHeader.includes(normRev))) {
                headerScore = 0.65;
                headerReason = `Header suggests '${rev}'`;
                isReviewAlias = true;
                break;
            }
        }
    }

    // 2. Value Pattern & Data Type & Range Scoring per field key
    let valuePatternScore = 0;
    let dataTypeScore = 0.5;
    let rangeScore = 0.5;
    let unitScore = 0.5;
    let semanticScore = 0.5;

    switch (field.key) {
        case "pricePerMeter": {
            const currencyCount = patternCounts.get("CURRENCY") || 0;
            const numericCount = (patternCounts.get("INTEGER") || 0) + (patternCounts.get("NUMERIC") || 0);

            // If samples have "/-" or currency symbols, very high pattern score
            if (currencyCount > 0) {
                valuePatternScore = currencyCount / sampleTotal;
                unitScore = 1.0;
            } else if (numericCount > 0) {
                valuePatternScore = (numericCount / sampleTotal) * 0.7;
            }

            // Price range check (typically 10 to 5,000)
            const prices = samples.map((s) => normalizePrice(s).numeric).filter((p): p is number => p !== null);
            if (prices.length > 0 && prices.every((p) => p >= 5 && p <= 20000)) {
                rangeScore = 1.0;
            }

            // Negative penalty if samples are construction ("112*82") or finish codes ("CM-ST")
            if (patternCounts.has("CONSTRUCTION") || patternCounts.has("FINISH_CODE")) {
                valuePatternScore = 0;
                semanticScore = 0;
            }
            break;
        }

        case "minimumOrderQuantity": {
            const rangeCount = patternCounts.get("QUANTITY_RANGE") || 0;
            const intCount = patternCounts.get("INTEGER") || 0;

            if (rangeCount > 0) {
                valuePatternScore = 1.0;
                unitScore = 1.0;
            } else if (intCount > 0) {
                valuePatternScore = intCount / sampleTotal;
            }

            // Typical MOQ range (50 to 500,000)
            const moqs = samples.map((s) => normalizeMoq(s).min).filter((m): m is number => m !== null);
            if (moqs.length > 0 && moqs.every((m) => m >= 50 && m <= 1000000)) {
                rangeScore = 1.0;
            }

            if (patternCounts.has("CONSTRUCTION") || patternCounts.has("FINISH_CODE")) {
                valuePatternScore = 0;
                semanticScore = 0;
            }
            break;
        }

        case "weightValue":
        case "gsm": {
            const intCount = patternCounts.get("INTEGER") || 0;
            const gsms = samples.map(normalizeGsm).filter((g): g is number => g !== null);

            // Typical GSM: 30 to 700
            if (gsms.length > 0 && gsms.every((g) => g >= 25 && g <= 800)) {
                rangeScore = 1.0;
                valuePatternScore = intCount > 0 ? intCount / sampleTotal : 0.8;
                dataTypeScore = 1.0;
            }

            // If header contains "gsm", massive boost
            if (normHeader.includes("gsm")) {
                semanticScore = 1.0;
            }

            // Negative if construction or finish code
            if (patternCounts.has("CONSTRUCTION") || patternCounts.has("FINISH_CODE") || patternCounts.has("CURRENCY")) {
                valuePatternScore = 0;
                semanticScore = 0;
            }
            break;
        }

        case "construction": {
            const conCount = patternCounts.get("CONSTRUCTION") || 0;
            if (conCount > 0) {
                valuePatternScore = conCount / sampleTotal;
                dataTypeScore = 1.0;
                semanticScore = 1.0;
            }

            // Header terms like "fin con", "construction", "con"
            if (normHeader.includes("fincon") || normHeader.includes("construction") || normHeader === "con") {
                headerScore = Math.max(headerScore, 0.95);
            }
            break;
        }

        case "blendDescription":
        case "composition": {
            if (normHeader.includes("blend") || normHeader.includes("composition") || normHeader.includes("content")) {
                headerScore = Math.max(headerScore, 0.9);
                const yarnCount = patternCounts.get("YARN_COUNT_COMPOSITION") || 0;
                if (yarnCount > 0) {
                    valuePatternScore = yarnCount / sampleTotal;
                    semanticScore = 1.0;
                }
            }
            break;
        }

        case "weaveType": {
            const weaveCount = patternCounts.get("WEAVE") || 0;
            if (weaveCount > 0) {
                valuePatternScore = weaveCount / sampleTotal;
                semanticScore = 1.0;
            }

            const recognizedWeaves = samples.map(normalizeWeave).filter(Boolean);
            if (recognizedWeaves.length > 0) {
                semanticScore = 1.0;
            }

            if (normHeader.includes("weave")) {
                headerScore = Math.max(headerScore, 0.95);
            }
            break;
        }

        case "widthValue":
        case "widthInches": {
            // CRUCIAL: Must check sample values!
            // If values are finish codes like "CM-ST", "TC-ST" -> DISQUALIFY for width!
            const finishCodeCount = patternCounts.get("FINISH_CODE") || 0;
            if (finishCodeCount > 0 && finishCodeCount / sampleTotal >= 0.5) {
                valuePatternScore = 0;
                semanticScore = 0;
                dataTypeScore = 0;
                rangeScore = 0;
                break;
            }

            // Check numeric values
            const widths = samples.map(normalizeWidth).filter((w): w is number => w !== null);
            // Typical widths: 30 to 200 (in inches or cm)
            if (widths.length > 0 && widths.every((w) => w >= 20 && w <= 250)) {
                rangeScore = 1.0;
                valuePatternScore = 0.95;
                dataTypeScore = 1.0;
            }

            // If header has "w" or "width"
            if (
                normHeader === "finishw" ||
                normHeader === "finishedwidth" ||
                normHeader === "width" ||
                normHeader.includes("width") ||
                normHeader === "fw"
            ) {
                headerScore = Math.max(headerScore, 0.95);
            }
            break;
        }

        case "leadTimeDays": {
            const daysCount = samples.filter((s) => /\b(days?|weeks?|months?)\b/i.test(String(s))).length;
            const numCount = patternCounts.get("INTEGER") || 0;
            if (daysCount > 0 || numCount > 0) {
                valuePatternScore = Math.max(daysCount, numCount) / sampleTotal;
                dataTypeScore = 1.0;
            }
            if (
                normHeader.includes("lead") ||
                normHeader.includes("delivery") ||
                normHeader.includes("dispatch") ||
                normHeader === "leadtime"
            ) {
                headerScore = Math.max(headerScore, 0.95);
            }
            break;
        }

        case "finishOptions": {
            const finishCodeCount = patternCounts.get("FINISH_CODE") || 0;
            const textCount = patternCounts.get("TEXT") || 0;
            if (finishCodeCount > 0) {
                valuePatternScore = finishCodeCount / sampleTotal;
                semanticScore = 1.0;
                dataTypeScore = 1.0;
            } else if (textCount > 0) {
                valuePatternScore = 0.7;
            }
            if (normHeader === "finish" || normHeader.includes("finishing") || normHeader.includes("finishcode")) {
                headerScore = Math.max(headerScore, 0.95);
            }
            break;
        }

        case "fabricName": {
            // Alphanumeric codes or unique strings
            const codeCount = patternCounts.get("ALPHANUMERIC_CODE") || 0;
            const textCount = patternCounts.get("TEXT") || 0;
            if (codeCount > 0 || textCount > 0) {
                valuePatternScore = 0.8;
                dataTypeScore = 1.0;
            }
            if (normHeader === "article" || normHeader.includes("articleno") || normHeader.includes("quality")) {
                headerScore = Math.max(headerScore, 0.95);
            }
            break;
        }

        case "dyeMethod": {
            // Only map to dyeMethod if header relates to dye/dyeing AND samples match yarn_dyed/piece_dyed
            if (!normHeader.includes("dye")) {
                valuePatternScore = 0;
                semanticScore = 0;
                dataTypeScore = 0;
                headerScore = 0;
                break;
            }

            const hasAllowedDyeMethod = samples.some((s) => {
                const l = String(s).toLowerCase();
                return l.includes("yarn") || l.includes("piece");
            });
            if (hasAllowedDyeMethod) {
                valuePatternScore = 1.0;
                semanticScore = 1.0;
                dataTypeScore = 0.9;
            } else {
                valuePatternScore = 0;
                semanticScore = 0;
            }
            break;
        }

        case "fabricState": {
            if (!normHeader.includes("state")) {
                valuePatternScore = 0;
                semanticScore = 0;
                dataTypeScore = 0;
                headerScore = 0;
                break;
            }

            const hasAllowedState = samples.some((s) => {
                const l = String(s).toLowerCase();
                return l === "greige" || l === "rfd" || l === "dyed" || l === "printed";
            });
            if (hasAllowedState) {
                valuePatternScore = 1.0;
                semanticScore = 1.0;
                dataTypeScore = 0.9;
            } else {
                valuePatternScore = 0;
                semanticScore = 0;
            }
            break;
        }

        default:
            break;
    }

    // Weight formula
    // Header compatibility: 40%
    // Value pattern: 30%
    // Semantic / domain fit: 15%
    // Range / Data type: 15%
    let totalScore =
        headerScore * 0.4 +
        valuePatternScore * 0.3 +
        semanticScore * 0.15 +
        ((rangeScore + dataTypeScore + unitScore) / 3) * 0.15;

    // Disqualification condition:
    // If header matched "finish w" but values are finish codes like "CM-ST", totalScore must be 0!
    if ((field.key === "widthInches" || field.key === "widthValue") && patternCounts.has("FINISH_CODE")) {
        totalScore = 0;
    }

    // If review alias matched, ensure totalScore satisfies review threshold
    if (isReviewAlias && totalScore < 0.55) {
        totalScore = 0.6;
    }

    // Determine confidence
    let confidence: MappingConfidence = "unmapped";
    let reason = "Low semantic similarity";

    if (totalScore >= 0.72 && !isReviewAlias) {
        confidence = "matched";
        reason = headerReason ? `${headerReason} with compatible sample values` : "High semantic confidence";
    } else if (totalScore >= 0.5 || isReviewAlias) {
        confidence = "review";
        reason = headerReason || "Moderate semantic compatibility, review recommended";
    }

    return {
        headerScore,
        valuePatternScore,
        dataTypeScore,
        semanticScore,
        rangeScore,
        unitScore,
        totalScore: Math.round(totalScore * 100) / 100,
        confidence,
        reason,
    };
}
