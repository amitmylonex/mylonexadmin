// Legacy payload rules retained; date formatting is explicitly IST in standalone Admin.
function format(date:Date,pattern:string){
  const parts=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true,timeZone:"Asia/Kolkata"}).formatToParts(date);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return pattern==="dd-MMM-yyyy"?`${part("day")}-${part("month")}-${part("year")}`:`${Number(part("hour"))}:${part("minute")} ${part("dayPeriod").toUpperCase()}`;
}
import { z } from "zod";

export const SAMPLE_THRESHOLD_M = 10000;
export const DEFAULT_DEADLINE_HOURS = 72;
const FLOW_ENABLED_SUPPLIER_RFQ_TEMPLATE = "rfq_new_enquiry";

const supplierTemplateTextParameterSchema = z.object({
    type: z.literal("text"),
    text: z.string()
        .transform((text) => text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim())
        .pipe(
            z.string()
                .min(1)
                .max(1024)
                .refine(
                    (text) => !/\b(?:undefined|null|NaN|Infinity|-Infinity)\b|\[object Object\]/i.test(text),
                    "Text parameter contains a malformed value."
                )
        ),
});

export function validateSupplierTemplateBodyParameters(
    parameters: unknown,
    expectedCount: number
): Array<{ type: "text"; text: string }> {
    const parsed = z.array(supplierTemplateTextParameterSchema).length(expectedCount).safeParse(parameters);
    if (!parsed.success) {
        throw new Error(
            `Invalid WhatsApp template body parameters: expected ${expectedCount} non-empty text values (maximum 1024 characters each).`
        );
    }
    return parsed.data;
}

function getExpectedBodyParameterCount(templateName: string, variableCount?: 10 | 13): number {
    if (
        templateName === "rfq_new_enquiry" ||
        templateName === "rfq_new_enquiry_v2" ||
        templateName === "rfq_new_enquiry_13"
    ) {
        return variableCount === 10 ? 10 : 13;
    }
    if (templateName === "rfq_reminder") return 4;
    if (templateName === "rfq_closed" || templateName === "rfq_shortlisted") return 2;
    if (templateName === "rfq_stock_reconfirm") return 5;
    return 5;
}

export interface SupplierRfqInquiryContext {
    rfqNumber: string;
    fabricName: string;
    quantity: number;
    requiredDeliveryDate?: Date | string | null;
    productionCycle?: string | null;
    deliveryPincode?: string | null;
    specPayload?: unknown;
    createdAt?: Date | string | null;
}

export interface SupplierRfqRecipientContext {
    companyName: string;
    normalizedPhone: string;
    preferredLanguage?: string | null;
}

export interface BuildSupplierRfqPayloadOptions {
    inquiry: SupplierRfqInquiryContext;
    supplier: SupplierRfqRecipientContext;
    templateName: string;
    templateLanguage: string;
    quoteDeadline?: Date | null;
    matchId?: string | null;
    flowToken?: string | null;
    flowButtonIndex?: number;
    lotNumber?: string | null;
    agreedPricePerM?: number | null;
    variableCount?: 10 | 13;
}


/**
 * Extracts and formats Construction / GSM / Width from real inquiry specPayload.
 * Never outputs newlines or invalid characters.
 */
export function formatConstructionGsmWidth(specPayload: unknown): string {
    if (!specPayload || typeof specPayload !== "object") {
        return "Standard specification";
    }
    const p = specPayload as Record<string, unknown>;
    const snapshot = p.selectedFabricSnapshot as Record<string, unknown> | undefined;
    const data = (p.data as Record<string, unknown> | undefined) || p;

    // 1. Construction
    let construction = "";
    if (typeof snapshot?.construction === "string" && snapshot.construction.trim()) {
        construction = snapshot.construction.trim();
    } else if (Array.isArray(data.templateSpecs)) {
        const specs = data.templateSpecs as Array<Record<string, unknown>>;
        const warp = specs.find(s => s.specKey === "warp_count_ply")?.valueText || specs.find(s => s.specKey === "warp_count_ply")?.valueNum;
        const weft = specs.find(s => s.specKey === "weft_count_ply")?.valueText || specs.find(s => s.specKey === "weft_count_ply")?.valueNum;
        if (warp && weft) {
            construction = `${warp} x ${weft}`;
        }
    }
    if (!construction && typeof data.yarnType === "string" && data.yarnType.trim()) {
        construction = data.yarnType.trim();
    }
    if (!construction && typeof data.weaveType === "string" && data.weaveType.trim()) {
        construction = data.weaveType.trim().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // 2. GSM
    const gsm = snapshot?.gsm ?? data.gsm;
    const gsmStr = gsm ? `${gsm} GSM` : "";

    // 3. Width
    const width = snapshot?.width ?? data.width;
    const widthStr = width
        ? (String(width).includes('"') || String(width).toLowerCase().includes("inch")
            ? String(width)
            : `${width}"`)
        : "";

    const parts = [construction, gsmStr, widthStr].filter(Boolean);
    if (parts.length === 0) {
        return "Standard specification";
    }
    return parts.join(" / ").replace(/[\r\n]+/g, " ").trim();
}

/**
 * Extracts and formats yarn count and construction from specPayload.
 */
export function formatCountConstruction(specPayload: unknown): string {
    if (!specPayload || typeof specPayload !== "object") {
        return "Standard specification";
    }
    const p = specPayload as Record<string, unknown>;
    const snapshot = p.selectedFabricSnapshot as Record<string, unknown> | undefined;
    const data = (p.data as Record<string, unknown> | undefined) || p;

    if (typeof snapshot?.construction === "string" && snapshot.construction.trim()) {
        return snapshot.construction.trim().replace(/[\r\n]+/g, " ");
    }
    if (Array.isArray(data.templateSpecs)) {
        const specs = data.templateSpecs as Array<Record<string, unknown>>;
        const warp = specs.find(s => s.specKey === "warp_count_ply")?.valueText || specs.find(s => s.specKey === "warp_count_ply")?.valueNum;
        const weft = specs.find(s => s.specKey === "weft_count_ply")?.valueText || specs.find(s => s.specKey === "weft_count_ply")?.valueNum;
        const epi = specs.find(s => s.specKey === "epi")?.valueText || specs.find(s => s.specKey === "epi")?.valueNum;
        const ppi = specs.find(s => s.specKey === "ppi")?.valueText || specs.find(s => s.specKey === "ppi")?.valueNum;
        if (warp && weft && epi && ppi) {
            return `${warp} x ${weft} / ${epi} x ${ppi}`.replace(/[\r\n]+/g, " ");
        }
        if (warp && weft) {
            return `${warp} x ${weft}`.replace(/[\r\n]+/g, " ");
        }
    }
    if (typeof data.yarnType === "string" && data.yarnType.trim()) {
        return data.yarnType.trim().replace(/[\r\n]+/g, " ");
    }
    return "Standard specification";
}

/**
 * Extracts and formats GSM from specPayload.
 */
export function formatGsm(specPayload: unknown): string {
    if (!specPayload || typeof specPayload !== "object") {
        return "Standard";
    }
    const p = specPayload as Record<string, unknown>;
    const snapshot = p.selectedFabricSnapshot as Record<string, unknown> | undefined;
    const data = (p.data as Record<string, unknown> | undefined) || p;

    const gsm = snapshot?.gsm ?? data.gsm;
    if (gsm !== undefined && gsm !== null && String(gsm).trim()) {
        const gsmStr = String(gsm).trim().replace(/[\r\n]+/g, " ");
        return gsmStr.toLowerCase().includes("gsm") ? gsmStr : `${gsmStr} GSM`;
    }
    return "Standard";
}

/**
 * Extracts and formats fabric width from specPayload.
 */
export function formatWidth(specPayload: unknown): string {
    if (!specPayload || typeof specPayload !== "object") {
        return "58\" (Standard)";
    }
    const p = specPayload as Record<string, unknown>;
    const snapshot = p.selectedFabricSnapshot as Record<string, unknown> | undefined;
    const data = (p.data as Record<string, unknown> | undefined) || p;

    const width = snapshot?.width ?? data.width;
    if (width !== undefined && width !== null && String(width).trim()) {
        const widthStr = String(width).trim().replace(/[\r\n]+/g, " ");
        return widthStr.includes('"') || widthStr.toLowerCase().includes("inch")
            ? widthStr
            : `${widthStr}"`;
    }
    return "58\" (Standard)";
}

/**
 * Extracts and formats fabric weave from specPayload.
 */
export function formatWeave(specPayload: unknown): string {
    if (!specPayload || typeof specPayload !== "object") {
        return "Standard";
    }
    const p = specPayload as Record<string, unknown>;
    const snapshot = p.selectedFabricSnapshot as Record<string, unknown> | undefined;
    const data = (p.data as Record<string, unknown> | undefined) || p;

    const rawWeave = snapshot?.weave ?? snapshot?.weaveType ?? data.weaveType ?? data.weave;
    if (typeof rawWeave === "string" && rawWeave.trim()) {
        return rawWeave.trim().replace(/[\r\n]+/g, " ").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Standard";
}


/**
 * Extracts and formats fabric finish details from specPayload.
 */
export function formatFabricFinish(specPayload: unknown): string {
    if (!specPayload || typeof specPayload !== "object") {
        return "Standard finish";
    }
    const p = specPayload as Record<string, unknown>;
    const snapshot = p.selectedFabricSnapshot as Record<string, unknown> | undefined;
    const data = (p.data as Record<string, unknown> | undefined) || p;

    if (typeof snapshot?.finish === "string" && snapshot.finish.trim()) {
        return snapshot.finish.trim().replace(/[\r\n]+/g, " ");
    }

    if (Array.isArray(data.finishTags) && data.finishTags.length > 0) {
        const formattedTags = data.finishTags
            .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
            .map((t) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
            .join(", ");
        if (formattedTags) {
            return formattedTags.replace(/[\r\n]+/g, " ");
        }
    }

    if (data.fabricState === "dyed") {
        const dyeMethod = typeof data.dyeMethod === "string" ? data.dyeMethod.replace(/_/g, " ") : "";
        const dyeColor = typeof data.dyeColorType === "string" ? data.dyeColorType.replace(/_/g, " ") : "";
        const details = [dyeMethod, dyeColor].filter(Boolean).join(" ");
        return details ? `${details.replace(/\b\w/g, (c) => c.toUpperCase())}` : "Dyed";
    }

    if (data.fabricState === "printed") {
        const printMethod = typeof data.printMethod === "string" ? data.printMethod.replace(/_/g, " ") : "";
        const baseType = typeof data.printBaseType === "string" ? `(${data.printBaseType.toUpperCase()})` : "";
        const details = [printMethod, baseType].filter(Boolean).join(" ");
        return details ? `${details.replace(/\b\w/g, (c) => c.toUpperCase())} printed` : "Printed";
    }

    if (data.fabricState === "grey") {
        return "Grey / Greige (RFD)";
    }

    return "Standard finish";
}

/**
 * Formats color and quantity splits into a strictly single-line string.
 * Meta rejects template variables containing line breaks.
 */
export function formatColoursAndQty(specPayload: unknown, totalQuantity: number): string {
    const totalFormatted = totalQuantity.toLocaleString("en-IN");
    if (!specPayload || typeof specPayload !== "object") {
        return `Single colour ${totalFormatted}`;
    }
    const p = specPayload as Record<string, unknown>;
    const shades = p.selectedShades;
    const qtyPerShade = typeof p.quantityPerShadeMeters === "number" ? p.quantityPerShadeMeters : null;

    if (Array.isArray(shades) && shades.length > 0) {
        const shadeStrings = shades.flatMap((shade) => {
            if (!shade || typeof shade !== "object") return [];
            const name = (shade as Record<string, unknown>).name;
            if (typeof name !== "string" || !name.trim()) return [];
            const shadeQty = qtyPerShade ?? Math.round(totalQuantity / shades.length);
            return [`${name.trim()} ${shadeQty.toLocaleString("en-IN")}`];
        });
        if (shadeStrings.length > 0) {
            return shadeStrings.join(" / ").replace(/[\r\n]+/g, " ");
        }
    }

    const data = (p.data as Record<string, unknown> | undefined) || p;
    if (Array.isArray(data.colorInfoList) && data.colorInfoList.length > 0) {
        const colorList = data.colorInfoList
            .filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
            .map((c) => c.trim());
        if (colorList.length > 0) {
            const perColor = Math.round(totalQuantity / colorList.length);
            return colorList
                .map((c) => `${c} ${perColor.toLocaleString("en-IN")}`)
                .join(" / ")
                .replace(/[\r\n]+/g, " ");
        }
    }

    if (typeof data.colorInfo === "string" && data.colorInfo.trim()) {
        return `${data.colorInfo.trim()} ${totalFormatted}`.replace(/[\r\n]+/g, " ");
    }

    if (data.fabricState === "grey") {
        return `Grey / Greige ${totalFormatted}`;
    }

    return `As per specification ${totalFormatted}`;
}

/**
 * Formats delivery requirement date or production cycle.
 */
export function formatRequiredBy(
    requiredDeliveryDate?: Date | string | null,
    productionCycle?: string | null
): string {
    if (requiredDeliveryDate) {
        const date = new Date(requiredDeliveryDate);
        if (!isNaN(date.getTime())) {
            return format(date, "dd-MMM-yyyy");
        }
    }
    if (productionCycle && typeof productionCycle === "string" && productionCycle.trim()) {
        const cycle = productionCycle.trim().toLowerCase();
        if (cycle === "urgent") return "Urgent cycle (15-20 days)";
        if (cycle === "regular") return "Regular cycle (30-45 days)";
        return `${productionCycle.replace(/_/g, " ")} cycle`;
    }
    return "Standard lead time";
}

/**
 * Determines fulfilment model: Ready Stock vs Fresh Production.
 */
export function formatFulfilmentModel(specPayload: unknown): string {
    if (!specPayload || typeof specPayload !== "object") {
        return "Fresh Production";
    }
    const p = specPayload as Record<string, unknown>;
    if (p.fulfilmentModel === "READY_STOCK" || p.origin === "ready_stock") {
        return "Ready Stock";
    }
    return "Fresh Production";
}

/**
 * Sampling requirement text strictly based on total quantity threshold.
 * <= 10,000 m: Required
 * > 10,000 m: Not required for this bulk enquiry
 */
export function formatSamplingRequirement(totalQuantity: number): string {
    if (totalQuantity <= SAMPLE_THRESHOLD_M) {
        return "Required. Share sample availability in your quote.";
    }
    return "Not required for this bulk enquiry.";
}

/**
 * Formats quote deadline timestamp into human-readable IST string.
 */
export function formatQuoteDeadline(quoteDeadline: Date): string {
    if (!quoteDeadline || isNaN(quoteDeadline.getTime())) {
        return "72 hours from receipt";
    }
    const datePart = format(quoteDeadline, "dd-MMM-yyyy");
    const timePart = format(quoteDeadline, "h:mm a");
    return `${datePart}, ${timePart} IST`;
}

/**
 * Main builder that constructs the Meta Cloud API payload for WhatsApp template messages.
 * Supports:
 * - `rfq_new_enquiry` (10 variables)
 * - `rfq_reminder` (4 variables)
 * - `rfq_stock_reconfirm` (5 variables)
 * - `rfq_closed` (2 variables)
 * - `rfq_shortlisted` (2 variables)
 * - `mylonex_supplier_rfq_forward_v1` (legacy 5 variables)
 */
export function buildSupplierRfqWhatsAppPayload(options: BuildSupplierRfqPayloadOptions): {
    messaging_product: "whatsapp";
    recipient_type: "individual";
    to: string;
    type: "template";
    template: {
        name: string;
        language: { code: string };
        components: Array<{
            type: "body" | "button";
            sub_type?: "flow" | "quick_reply";
            index?: string;
            parameters: Array<Record<string, unknown>>;
        }>;
    };
} {
    const {
        inquiry,
        supplier,
        templateName,
        templateLanguage,
        quoteDeadline = new Date(Date.now() + DEFAULT_DEADLINE_HOURS * 60 * 60 * 1000),
        lotNumber,
        agreedPricePerM,
    } = options;

    const deadline = quoteDeadline ?? new Date(Date.now() + DEFAULT_DEADLINE_HOURS * 60 * 60 * 1000);

    if (!templateName.trim() || !templateLanguage.trim()) {
        throw new Error("Invalid WhatsApp template configuration: template name and language are required.");
    }
    if (!Number.isFinite(inquiry.quantity) || inquiry.quantity <= 0) {
        throw new Error("Invalid WhatsApp template body parameters: RFQ quantity must be a positive number.");
    }

    let bodyParameters: Array<{ type: "text"; text: string }>;

    if (
        templateName === "rfq_new_enquiry" ||
        templateName === "rfq_new_enquiry_v2" ||
        templateName === "rfq_new_enquiry_13"
    ) {
        if (options.variableCount === 10) {
            // Legacy 10-variable structure
            const p1Rfq = inquiry.rfqNumber;
            const p2Quality = inquiry.fabricName;
            const p3Construction = formatConstructionGsmWidth(inquiry.specPayload);
            const p4Finish = formatFabricFinish(inquiry.specPayload);
            const p5Quantity = inquiry.quantity.toLocaleString("en-IN");
            const p6Colours = formatColoursAndQty(inquiry.specPayload, inquiry.quantity);
            const p7RequiredBy = formatRequiredBy(inquiry.requiredDeliveryDate, inquiry.productionCycle);
            const p8Fulfilment = formatFulfilmentModel(inquiry.specPayload);
            const p9Sampling = formatSamplingRequirement(inquiry.quantity);
            const p10Deadline = formatQuoteDeadline(deadline);

            bodyParameters = [
                { type: "text", text: p1Rfq },
                { type: "text", text: p2Quality },
                { type: "text", text: p3Construction },
                { type: "text", text: p4Finish },
                { type: "text", text: p5Quantity },
                { type: "text", text: p6Colours },
                { type: "text", text: p7RequiredBy },
                { type: "text", text: p8Fulfilment },
                { type: "text", text: p9Sampling },
                { type: "text", text: p10Deadline },
            ];
        } else {
            // Updated 13-variable structure (Count, GSM, Width, Weave separated)
            const p1Rfq = inquiry.rfqNumber;
            const p2Quality = inquiry.fabricName;
            const p3CountConstruction = formatCountConstruction(inquiry.specPayload);
            const p4Gsm = formatGsm(inquiry.specPayload);
            const p5Width = formatWidth(inquiry.specPayload);
            const p6Weave = formatWeave(inquiry.specPayload);
            const p7Finish = formatFabricFinish(inquiry.specPayload);
            const p8Quantity = inquiry.quantity.toLocaleString("en-IN");
            const p9Colours = formatColoursAndQty(inquiry.specPayload, inquiry.quantity);
            const p10RequiredBy = formatRequiredBy(inquiry.requiredDeliveryDate, inquiry.productionCycle);
            const p11Fulfilment = formatFulfilmentModel(inquiry.specPayload);
            const p12Sampling = formatSamplingRequirement(inquiry.quantity);
            const p13Deadline = formatQuoteDeadline(deadline);

            bodyParameters = [
                { type: "text", text: p1Rfq },
                { type: "text", text: p2Quality },
                { type: "text", text: p3CountConstruction },
                { type: "text", text: p4Gsm },
                { type: "text", text: p5Width },
                { type: "text", text: p6Weave },
                { type: "text", text: p7Finish },
                { type: "text", text: p8Quantity },
                { type: "text", text: p9Colours },
                { type: "text", text: p10RequiredBy },
                { type: "text", text: p11Fulfilment },
                { type: "text", text: p12Sampling },
                { type: "text", text: p13Deadline },
            ];
        }
    } else if (templateName === "rfq_reminder") {
        bodyParameters = [
            { type: "text", text: inquiry.rfqNumber },
            { type: "text", text: inquiry.fabricName },
            { type: "text", text: inquiry.quantity.toLocaleString("en-IN") },
            { type: "text", text: formatQuoteDeadline(deadline) },
        ];
    } else if (templateName === "rfq_closed" || templateName === "rfq_shortlisted") {
        bodyParameters = [
            { type: "text", text: inquiry.rfqNumber },
            { type: "text", text: inquiry.fabricName },
        ];
    } else if (templateName === "rfq_stock_reconfirm") {
        const colours = formatColoursAndQty(inquiry.specPayload, inquiry.quantity);

        // Clean and validate lotNumber: use provided value or explicit fallback without inventing a fake lot
        const formattedLot =
            typeof lotNumber === "string" && lotNumber.trim()
                ? lotNumber.trim().replace(/[\r\n]+/g, " ")
                : "Pending confirmation";

        // Format agreed price: clean numeric string without currency symbols (Meta template renders "at ₹{{5}}/m")
        let formattedPrice = "Pending";
        if (typeof agreedPricePerM === "number" && !isNaN(agreedPricePerM) && agreedPricePerM > 0) {
            formattedPrice = Number.isInteger(agreedPricePerM)
                ? String(agreedPricePerM)
                : agreedPricePerM.toFixed(2);
        }

        bodyParameters = [
            { type: "text", text: inquiry.rfqNumber },
            { type: "text", text: inquiry.quantity.toLocaleString("en-IN") },
            { type: "text", text: colours },
            { type: "text", text: formattedLot },
            { type: "text", text: formattedPrice },
        ];
    } else {

        // Fallback for legacy template (mylonex_supplier_rfq_forward_v1)
        const quantityFormatted = `${inquiry.quantity.toLocaleString("en-IN")} m`;
        const deliveryLocation = inquiry.deliveryPincode || "India";
        bodyParameters = [
            { type: "text", text: supplier.companyName },
            { type: "text", text: inquiry.rfqNumber },
            { type: "text", text: inquiry.fabricName },
            { type: "text", text: quantityFormatted },
            { type: "text", text: deliveryLocation },
        ];
    }

    const validatedBodyParameters = validateSupplierTemplateBodyParameters(
        bodyParameters,
        getExpectedBodyParameterCount(templateName, options.variableCount)
    );
    const components: Array<{
        type: "body" | "button";
        sub_type?: "flow" | "quick_reply";
        index?: string;
        parameters: Array<Record<string, unknown>>;
    }> = [
        {
            type: "body",
            parameters: validatedBodyParameters,
        },
    ];

    if (templateName === FLOW_ENABLED_SUPPLIER_RFQ_TEMPLATE) {
        const flowButtonIndex = options.flowButtonIndex;
        if (typeof flowButtonIndex !== "number" || !Number.isInteger(flowButtonIndex) || flowButtonIndex < 0 || flowButtonIndex > 9) {
            throw new Error("Invalid WhatsApp Flow button index: configure its zero-based position from the approved Meta template.");
        }

        const flowToken = options.flowToken || options.matchId || inquiry.rfqNumber;
        if (
            typeof flowToken !== "string" ||
            !flowToken.trim() ||
            flowToken.length > 256 ||
            /[\u0000-\u001f\u007f]/.test(flowToken)
        ) {
            throw new Error("Invalid WhatsApp Flow token: expected a non-empty value of at most 256 characters.");
        }

        components.push({
            type: "button",
            sub_type: "flow",
            index: String(options.flowButtonIndex),
            parameters: [
                {
                    type: "action",
                    action: {
                        flow_token: flowToken.trim(),
                        flow_action_data: {
                            rfq_heading: `Quotation for ${validatedBodyParameters[0].text}`,
                        },
                    },
                },
            ],
        });
    }

    return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: supplier.normalizedPhone,
        type: "template",
        template: {
            name: templateName,
            language: { code: templateLanguage },
            components,
        },
    };
}
