import type { ExcelCatalogRowMapped } from "./row-types.js";
import { SUPPLIER_DYE_METHODS, SUPPLIER_FABRIC_STATES, SUPPLIER_PRODUCTION_CYCLES } from "../constants.js";

export interface TargetFieldConfig {
    key: keyof ExcelCatalogRowMapped;
    label: string;
    required: boolean;
    description: string;
    aliases: string[];
    reviewAliases?: string[];
    options?: readonly string[];
    sourceOnly?: boolean;
}

// Historical header spellings remain part of this single registry.
const COMPATIBILITY_ALIASES: Partial<Record<keyof ExcelCatalogRowMapped, string[]>> = {
    fabricName: ["fabricname","fabric","name","articlename","itemname","article","articleno","articlenumber","item","itemcode","fabriccode","style","styleno","productcode","productname","product","quality","qualityno","qualitynumber","qualityname"],
    composition: ["composition","compositiontext","content","fibercontent","fibrecomposition","materialcomposition"],
    weightValue: ["gsm","gsm5","weight","fabricweight","gsmfinished","finishedgsm","grampersquaremeter","gramspersquaremeter","grm2","gm2"],
    widthValue: ["widthinches","widthinch","width","widthin","finishw","finishwidth","finishedwidth","finwidth","fw","fabricwidth","usablewidth","cuttablewidth","widthfinished","widthfinishedin"],
    count: ["count","yarncount","countdetails"],
    yarnType: ["yarntype"],
    construction: ["construction","countconstruction","fabricconstruction","finishedconstruction","fincon","structure","constructiondetails","density"],
    weaveType: ["weavetype","weave","weavestructure","fabricweave"],
    fabricState: ["fabricstate","state","finishstate"],
    dyeMethod: ["dyemethod","dyeingmethod","dyetype","dyeingtype","finishmethod"],
    productionCycle: ["productioncycle","cycle","productiontype"],
    pricePerMeter: ["pricepermeter","price","rate","pricem","priceperm","ratemeter","ratepermeter","ratem","rateperm","sellingprice","fabricprice","unitprice","cost","basicrate"],
    minimumOrderQuantity: ["minimumorderquantity","moq","minimumorder","minimumorderqty","minorderquantity","minorder","minqty","minimumqty","minorderqty","moqm","moqmeters"],
    leadTimeDays: ["leadtimedays","leadtime","deliverytime","deliverydays","productiontime","dispatchtime","productiondays","leaddays"],
    stockQuantity: ["stockquantity","stock","availablestock","currentstock","inventory"],
    city: ["city","locationcity","millcity"],
    locationState: ["locationstate","stateprovince","province","millstate"],
    fabricCollectionName: ["fabriccollectionname","collectionname","collection","season"],
    description: ["description","remarks","notes","buyernotes","comments"],
    finishOptions: ["finishoptions","finishes","finish","finishing","finishcode","finishtype","finishdetails"],
    imageUrl: ["imageurl","image","photo","photourl","pictureurl"],
};

const field = (key: TargetFieldConfig["key"], label: string, aliases: string[], options?: readonly string[]): TargetFieldConfig =>
    ({ key, label, aliases: Array.from(new Set([key, ...aliases, ...(COMPATIBILITY_ALIASES[key] ?? [])])), options, required: false, description: label });

// Mapping is optional: missing values can be corrected in the shared review editor.
export const TARGET_CATALOG_FIELDS: TargetFieldConfig[] = [
    field("fabricName", "Fabric Name", ["fabric name", "fabric", "article", "article name", "article no", "article number", "design name", "design no", "design number", "item name", "product name", "quality name"]),
    field("composition", "Blend / Composition", ["blend", "composition", "blend composition", "blend & composition", "fabric composition", "fiber composition", "fiber content"]),
    field("weightValue", "Weight", ["gsm", "oz", "weight", "fabric weight", "weight gsm", "weight oz", "gsm weight", "fabric gsm"]),
    { ...field("weightGlm", "GLM", ["glm", "weight glm", "grams per linear metre", "grams per linear meter"]), sourceOnly: true,
        description: "Source GLM used only when the mapped Weight is blank. GSM is calculated using the entered full fabric width." },
    field("widthValue", "Width", ["width", "width inches", "width in", "width cm", "fabric width", "usable width", "cuttable width", "finished width", "finish w", "fw"]),
    field("yarnType", "Yarn Type", ["yarn type", "spinning type"]),
    field("count", "Count", ["count", "yarn count", "fabric count"]),
    { ...field("countWarp", "Warp", ["warp", "warp count", "count warp"]), sourceOnly: true,
        description: "Combines with Weft as labelled Count text only when the mapped Count is blank." },
    { ...field("countWeft", "Weft", ["weft", "weft count", "count weft"]), sourceOnly: true,
        description: "Combines with Warp as labelled Count text only when the mapped Count is blank." },
    field("construction", "Construction", ["construction", "fabric construction", "density", "fin con", "epi ppi"]),
    field("weaveType", "Weave", ["weave", "weave type", "weave structure"]),
    field("fabricState", "Fabric State", ["fabric state", "state", "finish state"], SUPPLIER_FABRIC_STATES),
    field("dyeMethod", "Dye Method", ["dye", "dye method", "dye finish", "dyeing method"], SUPPLIER_DYE_METHODS),
    field("finishOptions", "Finish", ["finish", "finish type", "finish options", "finishes", "finish code", "finishing"]),
    field("productionCycle", "Production Cycle", ["order type", "production cycle", "production type", "cycle", "fulfilment mode", "fulfillment mode", "fulfilment type", "fulfillment type", "fulfilment", "fulfillment"], SUPPLIER_PRODUCTION_CYCLES),
    field("stockQuantity", "Stock Quantity", ["stock quantity", "stock", "inventory", "available stock"]),
    field("pricePerMeter", "Price per Meter", ["price per meter", "price meter", "price", "rate per meter", "rate"]),
    field("minimumOrderQuantity", "Minimum Order Quantity", ["minimum order quantity", "moq", "minimum quantity", "min order quantity", "min qty"]),
    field("leadTimeDays", "Lead Time (Days)", ["lead time days", "lead time", "delivery time", "dispatch time"]),
    field("sampleAvailability", "Sample Availability", ["sample availability", "sample", "sample available"]),
    field("city", "City", ["city", "mill city", "location city"]),
    field("locationState", "State / Province", ["location state", "state province", "province", "mill state"]),
    field("description", "Buyer Notes", ["description", "notes", "remarks", "buyer notes", "comments"]),
    field("imageUrl", "Image URL", ["image url", "image", "photo", "photo url"]),
    field("fabricCollectionName", "Collection Name", ["collection name", "collection", "collection season", "season"]),
];

// Composite source inputs have mapping controls, but edits use the resolved Count/Weight.
// Their original cells remain internal for remapping and traceability.
export const CATALOG_EDITOR_FIELDS = TARGET_CATALOG_FIELDS.filter(field => !field.sourceOnly);
export const isSourceOnlyField = (key: keyof ExcelCatalogRowMapped) =>
    TARGET_CATALOG_FIELDS.some(field => field.key === key && field.sourceOnly);

export const MAPPING_TARGET_OPTIONS = [
    ...TARGET_CATALOG_FIELDS.map(({ key, label, required }) => ({ key, label, required })),
    { key: "none" as const, label: "Do not import", required: false },
];

export function isShadeColumn(header: string) {
    return /colou?r|shade|pantone/i.test(header);
}

export const IMPORT_DEFAULTS: Partial<ExcelCatalogRowMapped> = {
    fabricState: "greige",
    productionCycle: "made-to-order", minimumOrderQuantity: 1000, leadTimeDays: 21, stockQuantity: 0,
    weightUnit: "GSM", widthUnit: "inches",
};

export function getProposedDefaults(data: ExcelCatalogRowMapped) {
    return Object.entries(IMPORT_DEFAULTS).filter(([key]) => {
        if (key === "stockQuantity" && data.productionCycle === "ready-stock") return false;
        if (key === "weightUnit" && data.gsm !== undefined && data.weightValue === undefined) return false;
        if (key === "widthUnit" && data.widthInches !== undefined && data.widthValue === undefined) return false;
        return String(data[key as keyof ExcelCatalogRowMapped] ?? "").trim() === "";
    });
}
