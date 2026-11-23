import { createHmac,timingSafeEqual } from "node:crypto";
import {z} from "zod";
import type {FastifyInstance} from "fastify";
import {PublicError} from "../../common/errors/public-error.js";
import {recordDispatchReceipt} from "./rfq-receipts.js";
export const bridgeReceiptSchema=z.object({messageId:z.string().min(1).max(500),status:z.enum(["SENT","DELIVERED","READ","FAILED"]),at:z.string().datetime(),failureCode:z.string().regex(/^\d{1,12}$/).optional(),attemptId:z.string().uuid().optional()}).strict();
export function receiptSignature(body:unknown,timestamp:string,secret:string) {
  const event=bridgeReceiptSchema.parse(body);
  return createHmac("sha256",secret).update(timestamp+"."+JSON.stringify(event)).digest("hex");
}
export function verifyReceiptBridge(body:unknown,timestamp:unknown,signature:unknown,secret:string,now=Date.now()) {
  if(!secret)throw new PublicError(503,"Receipt bridge is not configured");
  if(typeof timestamp!=="string"||!/^\d{10}$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000||typeof signature!=="string"||!/^[a-f0-9]{64}$/.test(signature)) throw new PublicError(401,"Invalid receipt bridge authentication");
  const expected=receiptSignature(body,timestamp,secret);
  if(!timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(signature,"hex")))throw new PublicError(401,"Invalid receipt bridge authentication");
  return bridgeReceiptSchema.parse(body);
}
export async function receiptBridgeRoutes(app:FastifyInstance, record=recordDispatchReceipt) {
  app.post("/api/v1/internal/rfq-dispatch-receipts",{bodyLimit:4096},async r=>{
    const body=verifyReceiptBridge(r.body,r.headers["x-mylonex-timestamp"],r.headers["x-mylonex-signature"],process.env.ADMIN_DISPATCH_RECEIPT_SECRET||"");
    return record({...body,at:new Date(body.at)});
  });
}
