// Server-side example for the EXISTING verified Meta webhook handler.
// Persist a retry job before acknowledging the provider; never expose this
// secret in browser code and never forward unverified provider payloads.
import {createHmac} from "node:crypto";
export async function forwardVerifiedReceipt(adminBaseUrl:string,secret:string,input:{messageId:string;status:string;at:string;failureCode?:string;attemptId?:string}) {
  const status=input.status.toUpperCase();
  if(!["SENT","DELIVERED","READ","FAILED"].includes(status))return;
  const event={messageId:input.messageId,status,at:input.at,...(input.failureCode?{failureCode:input.failureCode}:{}),...(input.attemptId?{attemptId:input.attemptId}:{})};
  const timestamp=String(Math.floor(Date.now()/1000));
  const body=JSON.stringify(event);
  const signature=createHmac("sha256",secret).update(timestamp+"."+body).digest("hex");
  const response=await fetch(new URL("/api/v1/internal/rfq-dispatch-receipts",adminBaseUrl),{method:"POST",signal:AbortSignal.timeout(5000),
    headers:{"Content-Type":"application/json","x-mylonex-timestamp":timestamp,"x-mylonex-signature":signature},body});
  const result=await response.json();
  if(!response.ok||!result.recorded)throw new Error("Retain this receipt for retry/reconciliation; the send acknowledgement may not have persisted yet");
}
