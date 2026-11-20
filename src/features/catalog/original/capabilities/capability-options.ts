export type CapabilityOption = { value: string; label: string };

function options(values: Array<[string, string]>): CapabilityOption[] {
    return values.map(([value, label]) => ({ value, label }));
}

export const STRUCTURE_OPTIONS = options([
    ["woven", "Woven"], ["knits", "Knits"], ["non_woven", "Non-woven"],
]);

export const MATERIAL_OPTIONS = options([
    ["cotton", "Cotton"], ["linen", "Linen"], ["viscose", "Viscose"], ["modal", "Modal"],
    ["lyocell", "Lyocell"], ["polyester", "Polyester"], ["nylon", "Nylon"], ["silk", "Silk"], ["wool", "Wool"],
]);

export const FABRIC_STATE_OPTIONS = options([
    ["greige", "Greige"], ["rfd", "RFD"], ["dyed", "Dyed"], ["printed", "Printed"],
    ["finished", "Finished"], ["coated", "Coated"], ["laminated", "Laminated"],
]);

export const FIBER_OPTIONS = options([
    ["100% cotton", "100% cotton"], ["cotton_linen", "Cotton-linen"], ["cellulose_blends", "Cellulose blends"],
    ["poly_cotton", "Poly-cotton"], ["poly_viscose", "Poly-viscose"], ["wool_blends", "Wool blends"], ["silk_blends", "Silk blends"],
]);

export const WEAVE_OPTIONS = options([
    ["plain", "Plain"], ["poplin", "Poplin"], ["twill", "Twill"], ["satin", "Satin"], ["oxford", "Oxford"],
    ["dobby", "Dobby"], ["jacquard", "Jacquard"], ["herringbone", "Herringbone"], ["chambray", "Chambray"],
    ["voile", "Voile"], ["seersucker", "Seersucker"], ["corduroy", "Corduroy"], ["canvas", "Canvas"], ["duck", "Duck"],
]);

export const DYE_OPTIONS = options([
    ["yarn_dyed", "Yarn-dyed"], ["piece_dyed", "Piece-dyed"], ["garment_dyed", "Garment-dyed"], ["greige_only", "Greige only"],
]);
export const PRINT_OPTIONS = options([
    ["digital", "Digital"], ["rotary", "Rotary"], ["screen", "Screen"], ["block", "Block"], ["none", "None"],
]);
export const COATING_OPTIONS = options([
    ["pu", "PU"], ["pvc", "PVC"], ["acrylic", "Acrylic"], ["wax", "Wax"], ["none", "None"],
]);
export const FINISH_OPTIONS = options([
    ["bio_washed", "Bio-wash"], ["wrinkle_free", "Wrinkle-free"], ["anti_pilling", "Anti-pilling"],
    ["mercerised", "Mercerised"], ["peach_finish", "Peach finish"], ["sanforised", "Sanforised"],
]);

export const LISTING_CYCLES = [
    { value: "ready_stock", label: "Ready Stock", detail: "Available against current stock" },
    { value: "running_production", label: "Running Production", detail: "Produced on a recurring mill cycle" },
    { value: "made_to_order", label: "Made to Order", detail: "Produced against confirmed orders" },
] as const;
