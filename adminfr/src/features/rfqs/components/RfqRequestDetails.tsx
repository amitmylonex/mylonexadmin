import {Suspense,lazy} from "react";
import type {RfqDetail} from "../types";
import {humanize,quantity,rfqDate} from "../utils/presentation";
const RfqEvidence = lazy(()=>import("./RfqRequirementEvidence").then(m=>({default:m.RfqRequirementEvidence})));
export function RfqRequestDetails({rfq}:{rfq:RfqDetail}) {
  const spec=rfq.specPayload||{};
  const fields=[['Requester',rfq.buyer.fullName||rfq.buyer.email],['Email',rfq.buyer.email],['Role',humanize(rfq.requesterRole)],['Fabric',rfq.fabricName],['Composition',spec.composition],['Quantity',quantity(rfq.quantity)],['Delivery pincode',rfq.deliveryPincode],['Required delivery',rfq.requiredDeliveryDate?rfqDate(rfq.requiredDeliveryDate):null],['Contact phone',rfq.contactPhone],['Production cycle',humanize(rfq.productionCycle)],['Status',humanize(rfq.status)],['Submitted',rfq.createdAt?rfqDate(rfq.createdAt):null],['Target price / m',rfq.targetPriceMin!=null||rfq.targetPriceMax!=null?[rfq.targetPriceMin,rfq.targetPriceMax].filter(v=>v!=null).map(v=>`₹${Number(v).toLocaleString('en-IN')}`).join(' – '):null]];
  return <section className="rounded-xl border border-border bg-white p-5 space-y-6"><h2 className="text-lg font-semibold">Request details</h2><dl className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 text-sm">{fields.filter(([,value])=>humanize(value)).map(([label,value])=><div key={String(label)}><dt className="text-xs text-muted">{String(label)}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{String(value)}</dd></div>)}</dl><Suspense fallback={<p className="text-sm text-muted">Loading requirement details…</p>}><RfqEvidence rfq={rfq}/></Suspense></section>;
}
