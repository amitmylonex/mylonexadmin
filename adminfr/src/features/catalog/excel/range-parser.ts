/**
 * Generic Numeric Range and Unit Parser for textile catalog data.
 *
 * Intelligently extracts min, max, unit, and normalized values from diverse supplier
 * representations such as "10K-20K", "60-69 DAYS", "120-125 GSM", "161/-", "145\"", "8 WEEKS".
 */

export interface ParsedNumericRange {
    rawValue: string;
    min: number | null;
    max: number | null;
    isRange: boolean;
    isInvertedRange?: boolean;
    isOpenEnded?: boolean;
    unit: string | null;
    normalizedValue: number | null;
    displayValue: string;
    confidence: number;
}

export type RangeParserDomain = "price" | "gsm" | "width" | "moq" | "leadTime" | "generic";

interface ParseOptions {
    domain?: RangeParserDomain;
    defaultUnit?: string;
}

/**
 * Parses numbers with multiplier suffixes:
 * "10K" -> 10000, "5L" -> 500000, "1M" -> 1000000, "10,000" -> 10000
 */
export function parseMultiplierNumber(valStr: string): number | null {
    if (!valStr) return null;
    const clean = valStr.trim().replace(/,/g, "");
    const match = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*([KkMmLlAaKkHhCcRr]*)\+?$/);
    if (!match) return null;

    const num = parseFloat(match[1]);
    if (isNaN(num) || num <= 0) return null;

    const suffix = (match[2] || "").toUpperCase();
    if (suffix.startsWith("K")) return Math.round(num * 1000);
    if (suffix.startsWith("M")) return Math.round(num * 1000000);
    if (suffix.startsWith("L") || suffix.startsWith("LAKH")) return Math.round(num * 100000);
    if (suffix.startsWith("CR")) return Math.round(num * 10000000);

    return num;
}

/**
 * Detects unit from raw textile strings.
 */
export function detectTextileUnit(str: string): { unit: string | null; cleaned: string } {
    let s = str.trim();

    // Clean common prefixes (e.g. "Width: 58", "Price: 160", "MOQ - 1000", "approx 120 GSM")
    s = s.replace(/^(?:width|gsm|moq|price|rate|lead\s*time)\s*[:=\-–—]\s*/i, "");
    s = s.replace(/\b(?:approx\.?|about|net|gross|upto|up to|around|approximate)\b/gi, "").trim();

    // Currency & Price per meter: "161/-", "₹161", "₹ 161", "INR 161", "161 per meter", "₹161/m", "161 INR/m"
    // Note: ensure "/-" is preceded by numbers and not part of "+/-" tolerance notation!
    const hasRupeeHyphen = /(?<=[0-9.,])\s*\/-/i.test(s) && !/\+\s*\/-/i.test(s);
    const hasCurrency =
        /[₹$€£]/.test(s) ||
        /\b(?:inr|usd|eur|gbp)\b/i.test(s) ||
        /\brs\.?/i.test(s) ||
        hasRupeeHyphen ||
        /\bper\s+(?:m|meter|mtr)\b/i.test(s) ||
        /\/\s*(?:m|meter|mtr)\b/i.test(s);

    if (hasCurrency) {
        const cleaned = s
            .replace(/[₹$€£]/g, "")
            .replace(/\b(?:inr|usd|eur|gbp)\b/gi, "")
            .replace(/\brs\.?/gi, "")
            .replace(/(?<=[0-9.,])\s*\/-\s*(?:per\s*m(?:tr|eter)?)?/gi, "")
            .replace(/\/\s*(?:m|meter|mtr)\b/gi, "")
            .replace(/\bper\s+(?:m|meter|mtr)\b/gi, "")
            .replace(/\s+/g, " ")
            .trim();
        return { unit: "INR", cleaned };
    }

    // GSM
    if (/\b(?:gsm|g\/m2|g\/m²|grams)\b/i.test(s)) {
        const cleaned = s.replace(/\b(?:gsm|g\/m2|g\/m²|grams)\b/gi, "").trim();
        return { unit: "GSM", cleaned };
    }

    // Width (Inches)
    if (/(?:\"|\binch(?:es)?\b|\bin\b)/i.test(s)) {
        const cleaned = s.replace(/(?:\"|\binch(?:es)?\b|\bin\b)/gi, "").trim();
        return { unit: "inches", cleaned };
    }

    // Lead Time (Days, Weeks, Months: e.g. "60 DAYS", "60d", "8 WEEKS", "2 MONTHS")
    if (/(?:\bdays?\b|(?<=[0-9\s])d\b)/i.test(s)) {
        const cleaned = s.replace(/(?:\bdays?\b|(?<=[0-9\s])d\b)/gi, "").trim();
        return { unit: "days", cleaned };
    }
    if (/(?:\bweeks?\b|\bwks?\b|(?<=[0-9\s])w\b)/i.test(s)) {
        const cleaned = s.replace(/(?:\bweeks?\b|\bwks?\b|(?<=[0-9\s])w\b)/gi, "").trim();
        return { unit: "weeks", cleaned };
    }
    if (/(?:\bmonths?\b|\bmths?\b|(?<=[0-9\s])mo\b)/i.test(s)) {
        const cleaned = s.replace(/(?:\bmonths?\b|\bmths?\b|(?<=[0-9\s])mo\b)/gi, "").trim();
        return { unit: "months", cleaned };
    }

    // MOQ / Quantity (meters, pcs)
    if (/\b(?:meters?|mtrs?|m)\b/i.test(s)) {
        const cleaned = s.replace(/\b(?:meters?|mtrs?|m)\b/gi, "").trim();
        return { unit: "meters", cleaned };
    }
    if (/\b(?:pcs|pieces)\b/i.test(s)) {
        const cleaned = s.replace(/\b(?:pcs|pieces)\b/gi, "").trim();
        return { unit: "pcs", cleaned };
    }

    return { unit: null, cleaned: s };
}

/**
 * Universal range parser supporting "10K-20K", "60-69 DAYS", "120-125 GSM", "122 (+-5)".
 */
export function parseNumericRange(
    rawVal: unknown,
    options: ParseOptions = {}
): ParsedNumericRange {
    const emptyResult: ParsedNumericRange = {
        rawValue: "",
        min: null,
        max: null,
        isRange: false,
        unit: options.defaultUnit || null,
        normalizedValue: null,
        displayValue: "",
        confidence: 0,
    };

    if (rawVal === null || rawVal === undefined) return emptyResult;

    if (typeof rawVal === "number") {
        if (rawVal <= 0) return { ...emptyResult, rawValue: String(rawVal) };
        return {
            rawValue: String(rawVal),
            min: rawVal,
            max: rawVal,
            isRange: false,
            unit: options.defaultUnit || null,
            normalizedValue: rawVal,
            displayValue: String(rawVal),
            confidence: 1.0,
        };
    }

    const rawStr = String(rawVal).trim();
    if (!rawStr || rawStr.startsWith("-") || /^\s*-\s*[0-9]/.test(rawStr) || /\bnegative\b/i.test(rawStr)) {
        return { ...emptyResult, rawValue: rawStr };
    }

    // In catalog MOQ notation, lowercase attached m means metres, not the M multiplier.
    // A single per-shade qualifier matches the existing MOQ semantics; compound quantities remain invalid.
    const domainText = options.domain === "moq" ? rawStr.replace(/(?<=\d)m\b/g, " meters").replace(/\bper\s+shade\b/gi, "").trim() : rawStr;
    const { unit: detectedUnit, cleaned } = detectTextileUnit(domainText);
    const unit = detectedUnit || options.defaultUnit || null;

    // 1. Plus pattern: e.g. "10K+", "10,000+", "5000+", "10K plus"
    const plusMatch = cleaned.match(/^([0-9.,]+\s*[KkMmLlAaKkHhCcRr]*)\s*(?:\+|\bplus\b)$/i);
    if (plusMatch) {
        let val = parseMultiplierNumber(plusMatch[1]);
        if (val !== null && val > 0) {
            if (unit === "weeks") val = Math.round(val * 7);
            else if (unit === "months") val = Math.round(val * 30);
            const displayUnit = unit === "weeks" || unit === "months" ? "days" : unit;
            return {
                rawValue: rawStr,
                min: val,
                max: null,
                isRange: false,
                isOpenEnded: true,
                unit: displayUnit,
                normalizedValue: val,
                displayValue: `${val.toLocaleString("en-IN")}+${displayUnit ? ` ${displayUnit}` : ""}`,
                confidence: 0.95,
            };
        }
    }

    // 2. Tolerance pattern e.g. "122 (+-5)", "122 (+/-5)", "122 +/- 5", "122 ± 5", "122 (+- 5%)"
    const tolMatch = cleaned.match(
        /^([0-9.,]+)\s*(?:\(\s*(?:±|\+\/\-|\+\-)\s*([0-9.,]+)\s*(%?)\s*\)|(?:±|\+\/\-|\+\-)\s*([0-9.,]+)\s*(%?))$/
    );
    if (tolMatch) {
        const base = parseFloat(tolMatch[1].replace(/,/g, ""));
        const tolNum = parseFloat((tolMatch[2] || tolMatch[4] || "0").replace(/,/g, ""));
        const isPercent = (tolMatch[3] || tolMatch[5]) === "%";
        const tol = isPercent ? (base * tolNum) / 100 : tolNum;
        if (!isNaN(base) && base > 0 && !isNaN(tol) && tol > 0) {
            const min = Math.max(0, Math.round(base - tol));
            const max = Math.round(base + tol);
            return {
                rawValue: rawStr,
                min,
                max,
                isRange: true,
                unit,
                normalizedValue: base,
                displayValue: `${min}–${max}${unit ? ` ${unit}` : ""}`,
                confidence: 0.95,
            };
        }
    }

    // 3. Range pattern: "10K-20K", "60-69", "10,000 - 20,000", "60 to 69"
    const rangeMatch = cleaned.match(
        /^([0-9.,]+\s*[KkMmLlAaKkHhCcRr]*)\s*(?:-|–|—|−|\bto\b)\s*([0-9.,]+\s*[KkMmLlAaKkHhCcRr]*)$/i
    );

    if (rangeMatch) {
        let lower = parseMultiplierNumber(rangeMatch[1]);
        let upper = parseMultiplierNumber(rangeMatch[2]);

        // Inherit multiplier if lower is small (e.g. "10-20K" -> 10,000 to 20,000)
        if (lower !== null && upper !== null && upper >= 1000 && lower < 100 && !/[kml]/i.test(rangeMatch[1])) {
            const ratio = upper >= 1000000 ? 1000000 : upper >= 100000 ? 100000 : 1000;
            lower = lower * ratio;
        }

        // Apply time unit conversion to days if applicable
        if (unit === "weeks" && lower !== null && upper !== null) {
            lower = Math.round(lower * 7);
            upper = Math.round(upper * 7);
        } else if (unit === "months" && lower !== null && upper !== null) {
            lower = Math.round(lower * 30);
            upper = Math.round(upper * 30);
        }

        if (lower !== null && lower > 0) {
            const displayUnit = unit === "weeks" || unit === "months" ? "days" : unit;

            // Inverted range check: min > max (e.g. "20K-10K", "130-120")
            if (upper !== null && upper < lower) {
                return {
                    rawValue: rawStr,
                    min: lower,
                    max: upper,
                    isRange: true,
                    isInvertedRange: true,
                    unit: displayUnit,
                    normalizedValue: lower,
                    displayValue: `${lower.toLocaleString("en-IN")}–${upper.toLocaleString("en-IN")}${
                        displayUnit ? ` ${displayUnit}` : ""
                    }`,
                    confidence: 0.3,
                };
            }

            const finalMax = upper !== null && upper >= lower ? upper : lower;
            return {
                rawValue: rawStr,
                min: lower,
                max: finalMax,
                isRange: true,
                unit: displayUnit,
                normalizedValue: lower, // Use minimum for single persistence value
                displayValue: `${lower.toLocaleString("en-IN")}–${finalMax.toLocaleString("en-IN")}${
                    displayUnit ? ` ${displayUnit}` : ""
                }`,
                confidence: 0.95,
            };
        }
    }

    // 3. Single value
    let single = parseMultiplierNumber(cleaned);
    if (single !== null && single > 0) {
        if (unit === "weeks") {
            single = Math.round(single * 7);
        } else if (unit === "months") {
            single = Math.round(single * 30);
        }

        const displayUnit = (unit === "weeks" || unit === "months") ? "days" : unit;
        return {
            rawValue: rawStr,
            min: single,
            max: single,
            isRange: false,
            unit: displayUnit,
            normalizedValue: single,
            displayValue: `${single.toLocaleString("en-IN")}${displayUnit ? ` ${displayUnit}` : ""}`,
            confidence: 0.9,
        };
    }

    return { ...emptyResult, rawValue: rawStr };
}
