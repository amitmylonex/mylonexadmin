import {createHmac} from "node:crypto";
import {z} from "zod";
import {prisma} from "../../../infrastructure/db.js";
import {buildSupplierRfqWhatsAppPayload} from "./legacy-whatsapp-payload.js";
import type {RfqSender} from "../../notifications/rfq-queue.js";
const configuration=z.object({
  WHATSAPP_ACCESS_TOKEN:z.string().min(1),WHATSAPP_PHONE_NUMBER_ID:z.string().regex(/^\d+$/),
  WHATSAPP_GRAPH_API_VERSION:z.string().regex(/^v\d+\.\d+$/).default("v20.0"),
  WHATSAPP_SUPPLIER_RFQ_TEMPLATE:z.string().min(1),WHATSAPP_TEMPLATE_LANGUAGE:z.string().default("en"),
  WHATSAPP_APP_SECRET:z.string().optional(),WHATSAPP_SUPPLIER_RFQ_FLOW_BUTTON_INDEX:z.coerce.number().int().min(0).max(9).optional(),
  WHATSAPP_SUPPLIER_RFQ_VARIABLE_COUNT:z.enum(["10","13"]).default("13"),
});
export function createWhatsAppSender(env:NodeJS.ProcessEnv=process.env,client=prisma,send:typeof fetch=fetch):RfqSender {
  const parsed=configuration.safeParse(env);
  if(!parsed.success)throw new Error("WhatsApp worker configuration is incomplete or invalid");
  const settings=parsed.data;
  if(settings.WHATSAPP_SUPPLIER_RFQ_TEMPLATE==="rfq_new_enquiry"&&(!settings.WHATSAPP_APP_SECRET||settings.WHATSAPP_SUPPLIER_RFQ_FLOW_BUTTON_INDEX===undefined))throw new Error("WhatsApp Flow configuration is incomplete");
  return async input=>{
    const match=await client.communicationRequestMatch.findUnique({where:{id:input.matchId},include:{communicationRequest:true,supplier:true}});
    if(!match||match.status!=="FORWARDED_TO_SUPPLIER"||match.supplier.status!=="APPROVED"||!match.supplier.whatsappConsent||!match.supplier.whatsappConsentAt)throw new Error("Supplier match is not eligible for sending");
    let flowToken:string|undefined;
    if(settings.WHATSAPP_SUPPLIER_RFQ_TEMPLATE==="rfq_new_enquiry"){
      const claims=Buffer.from(JSON.stringify([match.id,match.supplierId,match.communicationRequestId,Math.floor(Date.now()/1000)+30*86400])).toString("base64url");
      const signature=createHmac("sha256",settings.WHATSAPP_APP_SECRET!).update(`mylonex:supplier-quote:v1:${claims}`).digest("base64url");
      flowToken=`v1.${claims}.${signature}`;
    }
    const payload=buildSupplierRfqWhatsAppPayload({inquiry:match.communicationRequest,supplier:{companyName:match.supplier.companyName,normalizedPhone:input.phone,preferredLanguage:match.supplier.preferredLanguage},templateName:settings.WHATSAPP_SUPPLIER_RFQ_TEMPLATE,templateLanguage:settings.WHATSAPP_TEMPLATE_LANGUAGE,quoteDeadline:input.deadline,matchId:match.id,flowToken,flowButtonIndex:settings.WHATSAPP_SUPPLIER_RFQ_FLOW_BUTTON_INDEX,variableCount:Number(settings.WHATSAPP_SUPPLIER_RFQ_VARIABLE_COUNT) as 10|13});
    const response=await send(`https://graph.facebook.com/${settings.WHATSAPP_GRAPH_API_VERSION}/${settings.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${settings.WHATSAPP_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({...payload,...(input.attemptId?{biz_opaque_callback_data:input.attemptId}:{})})});
    const body=await response.json() as {messages?:Array<{id?:string}>};
    if(!response.ok||!body.messages?.[0]?.id)throw new Error("WhatsApp provider did not confirm message acceptance");
    return {messageId:body.messages[0].id};
  };
}
