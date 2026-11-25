import { rematchRfq } from "./matching/rematch.service.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
export async function rerunController(id: string, body: unknown, admin: {id:string;email:string}, requestId: string) {
  const result=await rematchRfq(id,body,admin.id);
  await logAuditEvent({actorId:admin.id,actorEmail:admin.email,targetType:"RFQ",targetId:id,action:"RFQ_REMATCH",reason:"Admin re-ran supplier matching",newState:result,requestId});
  return result;
}
