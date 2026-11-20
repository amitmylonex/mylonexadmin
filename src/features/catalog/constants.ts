export const SUPPLIER_CATALOG_FABRIC_TYPES = [
    "cotton",
    "polyester",
    "silk",
    "wool",
    "linen",
    "synthetic",
    "blended",
] as const;

export const SUPPLIER_PRODUCTION_CYCLES = [
    "ready-stock",
    "running-production",
    "made-to-order",
] as const;

export const SUPPLIER_WEAVE_TYPES = [
    "plain",
    "twill",
    "satin",
    "dobby",
    "jacquard",
    "oxford",
    "canvas",
    "poplin",
] as const;

export const SUPPLIER_FABRIC_STATES = ["greige", "rfd", "dyed", "printed"] as const;

export const SUPPLIER_DYE_METHODS = ["yarn_dyed", "piece_dyed"] as const;

export const SUPPLIER_FINISH_OPTIONS = [
    "Mercerised",
    "Sanforised",
    "Enzyme wash",
    "Peach finish",
    "Calendered",
    "Water repellent",
] as const;

export const SUPPLIER_TYPES = ["mill", "dealer"] as const;

export const WOVEN_MATERIAL_FAMILIES = [
    "cellulosic_cotton",
    "cellulosic_bast",
    "cellulosic_manmade",
    "synthetic",
    "wool_silk",
] as const;

export const WOVEN_WEAVE_TYPES = [
    "poplin",
    "twill",
    "satin",
    "oxford",
    "dobby",
    "canvas",
    "denim",
    "ripstop",
    "twill_2_1",
    "twill_3_1",
    "other",
] as const;

export const WOVEN_FINISH_CATEGORIES = [
    "greige",
    "dyed",
    "printed",
    "finished",
    "coated",
    "laminated",
] as const;

export const LISTING_TYPES = [
    "ready_stock",
    "running_production",
    "made_to_order",
] as const;

export const CATALOG_SOURCE_TYPES = ["supplier_catalog", "woven_product", "supplier_capability", "manual"] as const;

/** Source types that correspond to actual catalog listings and can be toggled active/inactive. */
export const TOGGLEABLE_CATALOG_SOURCE_TYPES = ["supplier_catalog", "woven_product", "supplier_capability"] as const;

export function toDbProductionCycle(value: typeof SUPPLIER_PRODUCTION_CYCLES[number]) {
    return value.replace(/-/g, "_") as "ready_stock" | "running_production" | "made_to_order";
}
