import {prisma} from "../../../infrastructure/db.js";
import {drainQueuedRfqNotifications} from "../../notifications/rfq-queue.js";
import {drainRfqResends} from "../../notifications/rfq-resends.js";
import {drainBuyerQuoteNotifications} from "../../quotes/quote-notification.js";
import {createWhatsAppSender} from "./provider.js";

// Explicit one-shot worker entrypoint; deployment can schedule repeated invocations.
// Importing or starting the API never enables outbound sends.
async function main(){
  if(process.env.RFQ_NOTIFICATION_WORKER_ENABLED!=="true")throw new Error("Set RFQ_NOTIFICATION_WORKER_ENABLED=true to run the delivery worker");
  const result:Record<string,unknown>={};
  if(process.env.WHATSAPP_ENABLED==="true"){
    const send=createWhatsAppSender();
    result.initial=await drainQueuedRfqNotifications(send);result.resends=await drainRfqResends(send);
  }
  if(process.env.POSTMARK_ENABLED==="true")result.buyerQuotes=await drainBuyerQuoteNotifications();
  console.log(JSON.stringify(result));
}
main().catch(()=>{console.error("RFQ notification worker failed. Check provider configuration and reconcile ambiguous attempts; no raw provider payload is logged.");process.exitCode=1;}).finally(()=>prisma.$disconnect());
