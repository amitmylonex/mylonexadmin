export type SpecValueType = "number" | "text";

export type WovenSpecDefinition = {
    key: string;
    label: string;
    valueType: SpecValueType;
    unit?: string;
    displayGroup: "Yarn" | "Density";
    isRequiredDefault?: boolean;
};

/**
 * Fixed set of 4 template specs used across all RFQ and woven listing forms.
 * Material-family-specific templates have been removed to simplify the form.
 */
export const WOVEN_SPEC_TEMPLATE: WovenSpecDefinition[] = [
    { key: "warp_count_ply", label: "Warp Count / Ply", valueType: "text", displayGroup: "Yarn", isRequiredDefault: true },
    { key: "weft_count_ply", label: "Weft Count / Ply", valueType: "text", displayGroup: "Yarn", isRequiredDefault: true },
    { key: "epi", label: "EPI", valueType: "number", displayGroup: "Density", isRequiredDefault: true },
    { key: "ppi", label: "PPI", valueType: "number", displayGroup: "Density", isRequiredDefault: true },
];