import {prisma} from "../../infrastructure/db.js";
import {PublicError} from "../../common/errors/public-error.js";
import {idSchema} from "../../common/pagination/query.js";
import {sampleDeliveredSchema} from "./sample.schema.js";
export async function delivered(rawId:unknown,body:unknown,actor:string,client=prisma) {
  const id=idSchema.parse({id:rawId}).id,input=sampleDeliveredSchema.parse(body);
  return client.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM samples WHERE id=${id} FOR UPDATE`;
    const sample=await tx.sample.findUnique({where:{id},include:{order:true}});
    if(!sample)throw new PublicError(404,"Sample request not found");
    if(sample.status!=="accepted_by_buyer"||sample.buyerDecision!=="accepted"||sample.deliveredAt)throw new PublicError(409,"Only an accepted, undelivered sample can be marked delivered");
    if(!sample.order)throw new PublicError(409,"This legacy sample has no linked order. Reconcile its acceptance/order before recording delivery.");
    const changed=await tx.order.updateMany({where:{id:sample.order.id,sampleId:id,status:{notIn:["CANCELLED","DELIVERED"]}},data:{status:"DELIVERED",trackingNumber:input.courierTrackingNumber}});
    if(!changed.count)throw new PublicError(409,"The sample order is cancelled or already delivered");
    const now=new Date();
    await tx.sample.update({where:{id},data:{status:"delivered",deliveredAt:now,deliveredByUserId:actor,courierName:input.courierName,courierTrackingNumber:input.courierTrackingNumber}});
    await tx.orderMilestone.create({data:{orderId:sample.order.id,title:"Sample delivered",description:`${input.courierName}: ${input.courierTrackingNumber}`,status:"DELIVERED"}});
    return {ok:true,sampleId:id,orderId:sample.order.id,status:"delivered",deliveredAt:now.toISOString()};
  });
}
