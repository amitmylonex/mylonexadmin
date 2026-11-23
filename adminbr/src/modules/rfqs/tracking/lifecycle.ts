export type LifecycleEvidence = { dispatchedAt: Date | null; quotedAt: Date | null; acceptedAt: Date | null; accepted: boolean; orderAt: Date | null;
  availableQuote: boolean; rejectedQuote: boolean; supplierDeclined: boolean; forwarded: boolean };
export function lifecycleSteps(inquiry: {createdAt:Date;status:string;adminReviewedAt?:Date|null}, e: LifecycleEvidence) {
  const approved = ["approved","active","open","in_progress","quoted","closed"].includes(inquiry.status) && Boolean(inquiry.adminReviewedAt);
  return [
    {key:"submitted",label:"Submitted",recorded:true,at:inquiry.createdAt.toISOString()},
    {key:"approved",label:"Admin Approved",recorded:approved,at:approved ? inquiry.adminReviewedAt!.toISOString() : null},
    {key:"dispatched",label:"Dispatched to Mills",recorded:Boolean(e.dispatchedAt),at:e.dispatchedAt?.toISOString() || null},
    {key:"quoted",label:"Quotes Received",recorded:Boolean(e.quotedAt),at:e.quotedAt?.toISOString() || null},
    {key:"accepted",label:"Buyer Accepted",recorded:e.accepted,at:e.acceptedAt?.toISOString() || null},
    {key:"ordered",label:"Order Placed",recorded:Boolean(e.orderAt),at:e.orderAt?.toISOString() || null},
  ];
}
export function evidenceStatus(e: LifecycleEvidence) {
  const label = e.orderAt ? "Order Placed" : e.accepted ? "Accepted" : e.availableQuote ? "Quotes Available" : e.rejectedQuote ? "Quote Declined" : e.supplierDeclined ? "Supplier Declined" : e.forwarded ? "Forwarded" : "Sourcing";
  return {label,tone:"slate"};
}
