export type FabricState = "greige" | "rfd" | "dyed" | "printed";
export type DyeMethod = "yarn_dyed" | "piece_dyed";

export type ShadeVariant = {
    id: string;
    name: string;
    colorHex?: string;
    millCode?: string;
    imageUrl?: string;
};

export type CatalogDraft = {
    fabricName: string;
    fabricType: string;
    composition: string;
    gsm: string;
    widthInches: string;
    construction: string;
    weaveType: string;
    fabricState: FabricState | "";
    dyeMethod?: DyeMethod;
    productionCycle: string;
    stockQuantity: string;
    pricePerMeter: string;
    minimumOrderQuantity: string;
    leadTimeDays: string;
    city: string;
    locationState: string;
    description: string;
    materialPurity: "pure" | "blended";
    blendDescription: string;
    finishOptions: string[];
    shadeVariants: ShadeVariant[];
    imageUrls: string[];
    fabricCollectionName: string;
    fabricCollectionId: string|null;
};

export type DraftUpdater = <K extends keyof CatalogDraft>(_key: K, _value: CatalogDraft[K]) => void;

export type FabricCollectionOption = {
    id: string;
    name: string;
    imageUrl?: string | null;
    count?: number;
};

export type QuickAddInitialData = {
    fabricName?: string;
    fabricType?: string;
    compositionText?: string | null;
    gsm?: number;
    widthInches?: number | string | null;
    construction?: string | null;
    weaveType?: string;
    fabricState?: FabricState | null;
    dyeMethod?: DyeMethod | null;
    productionCycle?: string;
    stockQuantity?: number;
    pricePerMeter?: number | string;
    minimumOrderQuantity?: number;
    leadTimeDays?: number;
    city?: string | null;
    locationState?: string | null;
    description?: string | null;
    materialPurity?: string | null;
    blendDescription?: string | null;
    finishOptions?: string[];
    shadeVariants?: ShadeVariant[] | null;
    colorOptions?: string[];
    imageUrls?: string[];
    fabricCollectionId?: string|null;
    fabricCollection?: { id: string; name: string } | null;
};
