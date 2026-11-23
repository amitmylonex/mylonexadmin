import { z } from "zod";

import {
    LISTING_TYPES,
    SUPPLIER_CATALOG_FABRIC_TYPES,
    SUPPLIER_DYE_METHODS,
    SUPPLIER_FABRIC_STATES,
    SUPPLIER_PRODUCTION_CYCLES,
    SUPPLIER_WEAVE_TYPES,
    TOGGLEABLE_CATALOG_SOURCE_TYPES,
    WOVEN_FINISH_CATEGORIES,
    WOVEN_WEAVE_TYPES,
} from "./constants.js";
import { getTemplateSpecKeys } from "./templates.js";

const optionalTrimmed = z.preprocess(
    (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    z.string().trim().max(5000).optional()
);

const optionalPositiveNumber = z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().positive().max(999999.99).optional()
);

export const shadeVariantSchema = z.object({
    id: z.string().trim().min(1).max(500),
    name: z.string().trim().min(1, "Colour or design name is required"),
    colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid colour").optional(),
    millCode: optionalTrimmed,
    imageUrl: z.string().url("Shade image URL must be valid").optional(),
}).superRefine((shade, ctx) => {
    if (!shade.colorHex && !shade.millCode) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["colorHex"],
            message: "Choose a colour or enter a Pantone / mill code",
        });
    }
});

export const quickAddSchema = z.object({
    fabricName: z.string().trim().min(1, "Fabric name is required").max(500),
    fabricType: z.enum(SUPPLIER_CATALOG_FABRIC_TYPES).default("cotton"),
    composition: optionalTrimmed,
    gsm: z.coerce.number().int().positive().max(10000),
    widthInches: optionalPositiveNumber,
    construction: optionalTrimmed,
    weaveType: z.string().trim().min(1, "Weave is required").max(200)
        .refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Weave must not contain control characters"),
    fabricState: z.enum(SUPPLIER_FABRIC_STATES),
    dyeMethod: z.enum(SUPPLIER_DYE_METHODS).optional(),
    productionCycle: z.enum(SUPPLIER_PRODUCTION_CYCLES).default("made-to-order"),
    stockQuantity: z.coerce.number().int().min(0).max(2147483647).default(0),
    pricePerMeter: z.coerce.number().positive("Price per meter is required").max(9999999999.99),
    minimumOrderQuantity: z.coerce.number().int().positive().max(2147483647),
    leadTimeDays: z.coerce.number().int().positive().max(3650),
    city: optionalTrimmed,
    locationState: optionalTrimmed,
    description: optionalTrimmed,
    fabricCollectionName: optionalTrimmed,
    fabricCollectionId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().default(false),
    materialPurity: z.enum(["pure", "blended"]).default("pure"),
    blendDescription: optionalTrimmed,
    // Optional at the API boundary so an older cached editor cannot erase
    // existing finishes during a rolling deployment.
    finishOptions: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    shadeVariants: z.array(shadeVariantSchema).max(100, "A fabric can have up to 100 shades").default([]),
    shadeVariantAction: z.enum(["preserve", "replace"]).optional(),
    imageUrls: z.array(z.string().url().max(2048).refine(value => value.startsWith("https://"), "Image URL must use HTTPS")).max(20).default([]),
}).superRefine((data, ctx) => {
    if (data.productionCycle === "ready-stock" && data.stockQuantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["stockQuantity"], message: "Ready stock requires positive stock quantity" });
    }
    if (data.materialPurity === "blended" && !data.blendDescription) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blendDescription"],
            message: "Blend description is required when material type is blended",
        });
    }

    if (data.fabricState === "dyed" && !data.dyeMethod) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dyeMethod"],
            message: "Choose yarn dyed or piece dyed",
        });
    }
});

export const fabricCollectionCreateSchema = z.object({
    name: z.string().trim().min(1, "Collection name is required").max(200),
    imageUrl: z.string().url("Collection image URL must be valid").max(2048).refine(value => value.startsWith("https://"), "Image URL must use HTTPS"),
});

export const fabricCollectionUpdateSchema = z.object({
    name: z.string().trim().min(1, "Collection name is required").max(200),
    imageUrl: z.string().url("Collection image URL must be valid").max(2048).refine(value => value.startsWith("https://"), "Image URL must use HTTPS"),
});

export const wovenSpecInputSchema = z.object({
    specKey: z.string().trim().min(1).max(500),
    valueNum: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().optional()),
    valueText: optionalTrimmed,
    unit: optionalTrimmed,
    system: optionalTrimmed,
    isRequired: z.boolean().optional(),
    displayGroup: optionalTrimmed,
    source: optionalTrimmed,
}).superRefine((data, ctx) => {
    if ((data.specKey === "epi" || data.specKey === "ppi") && data.valueNum !== undefined && data.valueNum <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valueNum"], message: "Density must be positive" });
    if (data.valueNum === undefined && !data.valueText) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["valueText"],
            message: "Either valueNum or valueText is required",
        });
    }
});

export const wovenListingSchema = z.object({
    compositionText: z.string().trim().min(1).max(500),
    materialFamily: z.enum(["cellulosic_cotton", "cellulosic_bast", "cellulosic_manmade", "synthetic", "wool_silk"]).default("cellulosic_cotton"),
    isActive: z.boolean().default(false),
    weaveType: z.enum(WOVEN_WEAVE_TYPES),
    finishCategory: z.enum(WOVEN_FINISH_CATEGORIES),
    gsmFinished: z.coerce.number().int().positive().max(10000),
    widthFinishedIn: z.coerce.number().positive().max(999999.99),
    listingType: z.enum(LISTING_TYPES).default("ready_stock"),
    priceInrPerM: z.coerce.number().positive().max(9999999999.99),
    moqMeters: z.coerce.number().int().positive().default(500),
    leadTimeDays: z.coerce.number().int().positive().max(3650),
    millName: optionalTrimmed,
    city: optionalTrimmed,
    locationState: optionalTrimmed,
    notes: optionalTrimmed,
    images: z.array(z.string().url().max(2048).refine(value => value.startsWith("https://"), "Image URL must use HTTPS")).max(20).default([]),
    specs: z.array(wovenSpecInputSchema).max(4).default([]),
}).superRefine((data, ctx) => {
    const templateKeys = new Set(getTemplateSpecKeys());
    if (new Set(data.specs.map(s => s.specKey)).size !== data.specs.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["specs"], message: "Duplicate technical spec" });
    for (const spec of data.specs) {
        if (!templateKeys.has(spec.specKey)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["specs"],
                message: `spec_key ${spec.specKey} is not valid`,
            });
        }
    }
});

// Color option with optional quantity for capability listings
const colorOptionWithQuantitySchema = z.object({
    color: z.string().trim().min(1, "Color name is required"),
    quantity: z.coerce.number().int().nonnegative().optional(),
});

export const supplierCapabilitySchema = z.object({
    capabilityName: z.string().trim().min(1).max(500),
    isActive: z.boolean().default(false),
    structures: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    materialTypes: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    fibers: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    fabricStates: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    gsmMin: z.coerce.number().int().positive().max(2147483647).optional(),
    gsmMax: z.coerce.number().int().positive().max(2147483647).optional(),
    widthMinInches: z.coerce.number().positive().max(999999.99).optional(),
    widthMaxInches: z.coerce.number().positive().max(999999.99).optional(),
    countRangeMin: z.coerce.number().positive().max(999999.99).optional(),
    countRangeMax: z.coerce.number().positive().max(999999.99).optional(),
    weaveTypes: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    finishTags: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    printMethods: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    coatingTypes: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    dyeMethods: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    colorOptionsWithQuantity: z.array(colorOptionWithQuantitySchema).default([]),
    constructionRangeMin: optionalTrimmed,
    constructionRangeMax: optionalTrimmed,
    materialPurity: z.enum(["pure", "blended"]).default("pure"),
    blendDescription: optionalTrimmed,
    priceMinInr: z.coerce.number().positive().max(999999.99).optional(),
    priceMaxInr: z.coerce.number().positive().max(999999.99).optional(),
    moqMeters: z.coerce.number().int().positive().max(2147483647).optional(),
    leadTimeDays: z.coerce.number().int().positive().max(2147483647).optional(),
    listingType: z.enum(LISTING_TYPES).default("ready_stock"),
    millName: optionalTrimmed,
    city: optionalTrimmed,
    locationState: optionalTrimmed,
    notes: optionalTrimmed,
    imageUrls: z.array(z.string().url().max(2048).refine(value => value.startsWith("https://"), "Image URL must use HTTPS")).max(20).default([]),
    linkedSupplierCatalogIds: z.array(z.string().uuid()).default([]),
    linkedWovenProductIds: z.array(z.string().uuid()).default([]),
}).superRefine((data, ctx) => {
    if (data.gsmMin && data.gsmMax && data.gsmMax < data.gsmMin) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gsmMax"], message: "gsmMax must be >= gsmMin" });
    }

    if (data.widthMinInches && data.widthMaxInches && data.widthMaxInches < data.widthMinInches) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["widthMaxInches"], message: "widthMaxInches must be >= widthMinInches" });
    }

    if (data.priceMinInr && data.priceMaxInr && data.priceMaxInr < data.priceMinInr) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceMaxInr"], message: "priceMaxInr must be >= priceMinInr" });
    }

    if ("countRangeMin" in data && data.countRangeMin && data.countRangeMax && data.countRangeMax < data.countRangeMin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["countRangeMax"], message: "Count maximum must be >= minimum" });
    if (data.materialPurity === "blended" && !data.blendDescription) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blendDescription"],
            message: "Blend description is required when material type is blended",
        });
    }
});

export const toggleListingSchema = z.object({
    sourceType: z.enum(TOGGLEABLE_CATALOG_SOURCE_TYPES),
    isActive: z.boolean(),
});

