import type { ExcelCatalogRowMapped } from "./row-types.js";
import { normalizeProductionCycle } from "./semantic.js";
export type FieldRequirement = 
    | { type: "always"; isRequired: boolean }
    | { type: "optional"; isRequired: boolean }
    | { type: "conditional"; isRequired: boolean };

export function getFieldRequirement(field: keyof ExcelCatalogRowMapped, data?: Partial<ExcelCatalogRowMapped>): FieldRequirement {
    switch (field) {
        case "fabricName":
            return { type: "optional", isRequired: false };
        case "pricePerMeter":
        case "composition":
        case "weaveType":
        case "weightUnit":
        case "weightValue":
        case "widthUnit":
        case "widthValue":
        case "sampleAvailability":
        case "productionCycle":
        case "minimumOrderQuantity":
            return { type: "always", isRequired: true };
        case "count": {
            const hasConstruction = Boolean(String(data?.construction ?? "").trim());
            return { type: "conditional", isRequired: !hasConstruction };
        }
        case "construction": {
            const hasCount = Boolean(String(data?.count ?? "").trim());
            return { type: "conditional", isRequired: !hasCount };
        }
        case "stockQuantity": {
            const normCycle = data?.productionCycle ? normalizeProductionCycle(data.productionCycle) : undefined;
            return { type: "conditional", isRequired: normCycle === "ready-stock" };
        }
        case "dyeMethod":
            return { type: "conditional", isRequired: data?.fabricState === "dyed" };
        default:
            return { type: "optional", isRequired: false };
    }
}

