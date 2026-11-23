export type ColorOption = { color: string; quantity?: number };

export type CapabilityFormInitialData = {
    capabilityName?: string;
    structures?: string[];
    materialTypes?: string[];
    fibers?: string[];
    fabricStates?: string[];
    gsmMin?: number | string | null;
    gsmMax?: number | string | null;
    widthMinInches?: number | string | null;
    widthMaxInches?: number | string | null;
    countRangeMin?: number | string | null;
    countRangeMax?: number | string | null;
    weaveTypes?: string[];
    finishTags?: string[];
    printMethods?: string[];
    coatingTypes?: string[];
    dyeMethods?: string[];
    colorOptionsWithQuantity?: ColorOption[] | null;
    constructionRangeMin?: string | null;
    constructionRangeMax?: string | null;
    materialPurity?: string;
    blendDescription?: string | null;
    priceMinInr?: number | string | null;
    priceMaxInr?: number | string | null;
    moqMeters?: number | string | null;
    leadTimeDays?: number | string | null;
    listingType?: string;
    millName?: string | null;
    city?: string | null;
    locationState?: string | null;
    notes?: string | null;
    imageUrls?: string[];
    linkedSupplierCatalogIds?: string[];
    linkedWovenProductIds?: string[];
};

export type ListingOption = {
    id: string;
    label: string;
    sourceType: "supplier_catalog" | "woven_product";
};
