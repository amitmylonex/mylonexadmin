import {randomUUID} from "node:crypto";
import {prisma} from "../../infrastructure/db.js";
import {sampleTotal} from "../../common/money/sample-money.mjs";
/** Buyer-owned decision boundary. Used by the prepared marketplace integration;
 * no ADMIN endpoint impersonates a buyer's acceptance. */
export async function decideSampleQuote(client: typeof prisma, sampleId:string, buyerId:string, decision:"accepted"|"rejected", reason?:string) {
  return client.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM samples WHERE id=${sampleId} FOR UPDATE`;
    const sample=await tx.sample.findFirst({where:{id:sampleId,buyerId}});
    if(!sample||sample.status!=="quoted"||sample.buyerDecision)throw new Error("CONFLICT: Sample is no longer awaiting this requester's decision");
    if(decision==="accepted") {
      if(!sample.quoteValidUntil||sample.quoteValidUntil<=new Date())throw new Error("CONFLICT: Sample quote has expired");
      if(sampleTotal(sample.quoteSampleCostInr?.toString(),sample.quoteCourierCostInr?.toString())===null)throw new Error("CONFLICT: Sample quote costs are incomplete");
      await tx.$queryRaw`SELECT id FROM "SupplierProfile" WHERE id=${sample.supplierId} FOR SHARE`;
      const supplier=await tx.supplierProfile.findFirst({where:{id:sample.supplierId,status:"APPROVED"},select:{id:true}});
      if(!supplier)throw new Error("CONFLICT: Sample fulfillment supplier is unavailable; contact support");
    }
    const updated=await tx.sample.update({where:{id:sample.id},data:{status:decision==="accepted"?"accepted_by_buyer":"rejected_by_buyer",buyerDecision:decision,buyerDecisionReason:reason?.trim()||null,buyerDecisionAt:new Date()}});
    if(decision==="accepted")await tx.order.create({data:{orderNumber:`ORD-SMPL-${randomUUID()}`,orderType:"sampling",sampleId:sample.id,buyerId:sample.buyerId,supplierId:sample.supplierId,status:"PENDING_PAYMENT",
      milestones:{create:{title:"Sample order placed",description:"Requester accepted the sample quotation.",status:"PENDING_PAYMENT"}}}});
    return updated;
  });
}
