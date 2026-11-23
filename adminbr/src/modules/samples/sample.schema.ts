import {z} from "zod";
import {listQuerySchema} from "../../common/pagination/query.js";
import {sampleChargeCents,formatSampleCents,sampleTotal} from "../../common/money/sample-money.mjs";
const charge=z.union([z.number().finite(),z.string()]).refine(value=>sampleChargeCents(value)!==null,"Enter a nonnegative INR amount with at most two decimal places")
  .transform(value=>formatSampleCents(sampleChargeCents(value)!));
export const sampleListSchema=listQuerySchema.extend({status:z.enum(["","all","requested","quoted","accepted_by_buyer","rejected_by_buyer","rejected","delivered"]).default("")});
export const sampleQuoteSchema=z.object({supplierId:z.string().uuid().optional(),quoteSampleCostInr:charge,quoteCourierCostInr:charge,quoteDeliveryTimeline:z.string().trim().min(1).max(500),
  quoteRefundPolicy:z.enum(["full","partial","none"]),quoteValidUntil:z.string().datetime({offset:true}).refine(value=>new Date(value)>new Date(),"Quote expiry must be in the future"),
  quoteInternalNotes:z.string().trim().max(5000).optional()}).strict().refine(input=>sampleTotal(input.quoteSampleCostInr,input.quoteCourierCostInr)!==null,{path:["quoteCourierCostInr"],message:"Combined sample cost exceeds the supported amount"});
export const sampleRejectSchema=z.object({rejectionReason:z.string().trim().min(1).max(1000)}).strict();
export const sampleDeliveredSchema=z.object({courierName:z.string().trim().min(1).max(100),courierTrackingNumber:z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/,"Enter a valid courier tracking code")}).strict();
