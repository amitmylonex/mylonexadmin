import { config } from "../../config.js";
const specKeys = ["weaveType", "knitType", "gsm", "gsmMin", "gsmMax", "width", "openWidthIn", "diaIn", "fabricState", "yarnType", "count", "construction", "blendComposition", "materialType", "templateSpecs", "finishOptions", "remarks", "buyerRemarks", "notes"];
export function visibleRfq(request: any) {
  const anonymous = config.anonymizeRfqBuyers || !request.buyerIdentityDisclosed;
  const clean = (value: unknown): unknown => {
    if (typeof value === "string") return anonymous ? value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email hidden]").replace(/\+?\d[\d ()-]{8,}\d/g, "[phone hidden]") : value;
    if (Array.isArray(value)) return value.slice(0, 50).map(clean);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => ["specKey", "valueNum", "valueText", "unit"].includes(key)).map(([key, item]) => [key, clean(item)]));
    return value;
  };
  const raw = request.specPayload && typeof request.specPayload === "object" ? request.specPayload as Record<string, any> : {};
  const data = raw.data && typeof raw.data === "object" ? raw.data : {};
  return { id: request.id, rfqNumber: request.rfqNumber, fabricName: clean(request.fabricName), quantity: request.quantity,
    targetPriceMin: request.targetPriceMin, targetPriceMax: request.targetPriceMax, requiredDeliveryDate: request.requiredDeliveryDate,
    deliveryPincode: request.deliveryPincode, priority: request.priority, createdAt: request.createdAt,
    buyerReference: clean(anonymous ? request.anonymizedBuyerReference || `Buyer for ${request.rfqNumber}` : request.buyer?.fullName || request.buyer?.email || request.anonymizedBuyerReference),
    buyerAnonymized: anonymous, buyerRemarks: clean(request.buyerMessage),
    specPayload: { composition: clean(raw.composition), fabricStructure: clean(raw.fabricStructure), data: Object.fromEntries(specKeys.filter(key => data[key] !== undefined).map(key => [key, clean(data[key])])) },
    routingTargets: clean(request.routingTargets), routingReason: clean(request.routingReason) };
}
