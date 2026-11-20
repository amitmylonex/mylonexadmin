import type { CapabilityFormInitialData, ListingOption } from "./capability-types";

export function text(value?: string | number | null) {
    return value === null || value === undefined ? "" : String(value);
}

export function numeric(form: FormData, name: string) {
    const value = String(form.get(name) ?? "").trim();
    return value ? Number(value) : undefined;
}

export function initialSelections(data?: CapabilityFormInitialData) {
    return {
        structures: data?.structures ?? [],
        materialTypes: data?.materialTypes ?? [],
        fabricStates: data?.fabricStates ?? [],
        fibers: data?.fibers ?? [],
        weaveTypes: data?.weaveTypes ?? [],
        dyeMethods: data?.dyeMethods ?? [],
        printMethods: data?.printMethods ?? [],
        coatingTypes: data?.coatingTypes ?? [],
        finishTags: data?.finishTags ?? [],
    };
}

export function validateRanges(form: FormData) {
    const pairs = [
        ["gsmMin", "gsmMax", "GSM"],
        ["widthMinInches", "widthMaxInches", "Width"],
        ["countRangeMin", "countRangeMax", "Count"],
        ["priceMinInr", "priceMaxInr", "Price"],
    ] as const;

    return pairs.flatMap(([minName, maxName, label]) => {
        const min = numeric(form, minName);
        const max = numeric(form, maxName);
        return min !== undefined && max !== undefined && max < min
            ? [`${label} maximum must be greater than or equal to its minimum.`]
            : [];
    });
}

function record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function labelPart(value: unknown, fallback: string) {
    return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function listingOption(value: unknown, sourceType: ListingOption["sourceType"]): ListingOption | null {
    const item = record(value);
    if (!item || typeof item.id !== "string") return null;
    const name = sourceType === "supplier_catalog"
        ? labelPart(item.fabricName, "Untitled fabric")
        : labelPart(item.compositionText, "Untitled woven fabric");
    const weave = labelPart(item.weaveType, "weave not set");
    const gsm = sourceType === "supplier_catalog" ? labelPart(item.gsm, "—") : labelPart(item.gsmFinished, "—");
    return { id: item.id, label: `${name} (${weave}, ${gsm} GSM)`, sourceType };
}

export function buildListingOptions(payload: unknown) {
    const data = record(record(payload)?.data);
    const catalogEntries = Array.isArray(data?.catalogEntries) ? data.catalogEntries : [];
    const wovenProducts = Array.isArray(data?.wovenProducts) ? data.wovenProducts : [];
    return [
        ...catalogEntries.map((item) => listingOption(item, "supplier_catalog")),
        ...wovenProducts.map((item) => listingOption(item, "woven_product")),
    ].filter((item): item is ListingOption => item !== null);
}
