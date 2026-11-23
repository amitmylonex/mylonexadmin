import type { CatalogKind } from "../../contracts/admin-contracts";
export type Kind = CatalogKind;
export type Field = { key: string; label: string; type?: "number" | "text" | "textarea" | "tags" | "select"; options?: string[]; required?: boolean; min?: number; max?: number; step?: number; section?: string };
const text = (key: string, label: string, required = false): Field => ({ key, label, required });
const num = (key: string, label: string, required = false, min = 0.01): Field => ({ key, label, type: "number", required, min, max: ["gsm", "gsmFinished"].includes(key) ? 10000 : key === "leadTimeDays" ? 3650 : 2147483647, step: ["gsm", "gsmFinished", "stockQuantity", "minimumOrderQuantity", "moqMeters", "leadTimeDays", "gsmMin", "gsmMax"].includes(key) ? 1 : 0.01 });
const select = (key: string, label: string, options: string[]): Field => ({ key, label, type: "select", options, required: true });
const tags = (key: string, label: string): Field => ({ key, label, type: "tags" });
const commercial = [select("listingType", "Supply model", ["ready_stock", "running_production", "made_to_order"]), num("moqMeters", "MOQ (metres)", true, 1), num("leadTimeDays", "Lead time (days)", true, 1), text("city", "City"), text("locationState", "State"), text("millName", "Mill name"), { key: "notes", label: "Buyer / technical notes", type: "textarea" as const }];
export const fields: Record<Kind, Field[]> = {
  collections: [text("name", "Collection name", true)],
  fabrics: [
    { ...text("fabricName", "Fabric / article name", true), section: "01 · Fabric specification" },
    select("fabricType", "Material", ["cotton", "polyester", "silk", "wool", "linen", "synthetic", "blended"]), text("composition", "Blend / composition"), text("construction", "Construction"),
    text("weaveType", "Weave", true), num("gsm", "GSM", true, 1), num("widthInches", "Width (inches)"), select("materialPurity", "Material type", ["pure", "blended"]), text("blendDescription", "Blend description (required for blended)"), { key: "description", label: "Buyer notes", type: "textarea" },
    { ...select("fabricState", "Fabric state", ["greige", "rfd", "dyed", "printed"]), section: "02 · Fabric state and finishing" },
    { key: "dyeMethod", label: "Dye method (required for dyed)", type: "select", options: ["yarn_dyed", "piece_dyed"] }, tags("finishOptions", "Finishes (comma separated)"),
    { ...select("productionCycle", "Supply model", ["ready-stock", "running-production", "made-to-order"]), section: "03 · Commercials" }, num("stockQuantity", "Stock quantity (metres)", false, 0), num("minimumOrderQuantity", "MOQ (metres)", true, 1), num("leadTimeDays", "Lead time (days)", true, 1), num("pricePerMeter", "Base price INR / metre", true), text("city", "City"), text("locationState", "State"),
  ],
  woven: [
    { ...text("compositionText", "Composition", true), section: "Detailed woven specification" }, select("materialFamily", "Material family", ["cellulosic_cotton", "cellulosic_bast", "cellulosic_manmade", "synthetic", "wool_silk"]), select("weaveType", "Weave", ["poplin", "twill", "satin", "oxford", "dobby", "canvas", "denim", "ripstop", "twill_2_1", "twill_3_1", "other"]), select("finishCategory", "Finish category", ["greige", "dyed", "printed", "finished", "coated", "laminated"]), num("gsmFinished", "GSM", true, 1), num("widthFinishedIn", "Width (inches)", true), num("priceInrPerM", "Price INR / metre", true), ...commercial,
  ],
  capabilities: [
    { ...text("capabilityName", "Product line name", true), section: "01 · Range identity" }, tags("structures", "Structures"), tags("materialTypes", "Materials"), tags("fibers", "Fibres"), tags("fabricStates", "Fabric states"),
    { ...tags("weaveTypes", "Weaves"), section: "02 · Materials and construction" }, num("gsmMin", "GSM minimum", false, 1), num("gsmMax", "GSM maximum", false, 1), num("widthMinInches", "Width minimum (in)"), num("widthMaxInches", "Width maximum (in)"), num("countRangeMin", "Count minimum"), num("countRangeMax", "Count maximum"), text("constructionRangeMin", "Construction minimum"), text("constructionRangeMax", "Construction maximum"), select("materialPurity", "Material type", ["pure", "blended"]), text("blendDescription", "Blend description"),
    { ...tags("dyeMethods", "Dyeing methods"), section: "03 · Processing" }, tags("printMethods", "Printing methods"), tags("coatingTypes", "Coatings"), tags("finishTags", "Finishing"),
    { ...num("priceMinInr", "Price minimum INR"), section: "04 · Commercial terms" }, num("priceMaxInr", "Price maximum INR"), ...commercial,
  ],
};
export const titles: Record<Kind, string> = { collections: "Collection", fabrics: "Quick-add fabric", woven: "Woven listing", capabilities: "Supplier capability" };
export const defaults: Record<Kind, Record<string, unknown>> = {
  collections: {},
  fabrics: { fabricType: "cotton", weaveType: "plain", fabricState: "greige", materialPurity: "pure", productionCycle: "made-to-order", stockQuantity: 0, gsm: 100, widthInches: 58, isActive: false },
  woven: { materialFamily: "cellulosic_cotton", weaveType: "poplin", finishCategory: "greige", listingType: "ready_stock", isActive: false },
  capabilities: { materialPurity: "pure", listingType: "made_to_order", isActive: false },
};
