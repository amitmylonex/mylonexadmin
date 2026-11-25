import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { buyerDateRange } from "../buyers/buyer.schema.js";
import { pageInfo, paging, listQuerySchema } from "../../common/pagination/query.js";
const day = z.preprocess(v => v === "" ? undefined : v, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + "T00:00:00Z"); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v;
}, "Enter a valid calendar date").optional());
const quantity = z.preprocess(v => v === "" ? undefined : v, z.coerce.number().int().min(0).max(2147483647).optional());
export const registrySchema = listQuerySchema.extend({ status: z.enum(["", "all", "pending", "active", "quoted", "closed", "cancelled", "rejected"]).default(""),
  from: day, to: day, quantityMin: quantity, quantityMax: quantity }).refine(q => !q.from || !q.to || q.from <= q.to, {path:["to"],message:"End date must follow start date"})
  .refine(q => q.quantityMin === undefined || q.quantityMax === undefined || q.quantityMin <= q.quantityMax, {path:["quantityMax"],message:"Maximum quantity must be at least minimum quantity"});
const hasQuote: Prisma.CommunicationRequestWhereInput = { matches: { some: { response: { isNot: null } } } };
const hasOrder: Prisma.CommunicationRequestWhereInput = { matches: { some: { response: { is: { order: { isNot: null } } } } } };
const terminal = ["closed","cancelled","rejected"];
export function registryWhere(q: z.infer<typeof registrySchema>): Prisma.CommunicationRequestWhereInput {
  const clauses: Prisma.CommunicationRequestWhereInput[] = [];
  if (q.status === "closed") clauses.push({ OR: [{status:"closed"}, { AND: [{status:{notIn:["cancelled","rejected"]}},hasOrder] }] });
  else if (q.status === "quoted") clauses.push({ AND: [{status:{notIn:terminal}}, {NOT:hasOrder}, {OR:[{status:"quoted"},hasQuote]}] });
  else if (q.status === "active") clauses.push({ AND: [{status:{in:["approved","active","open","in_progress"]}},{NOT:hasQuote},{NOT:hasOrder}] });
  else if (q.status === "pending") clauses.push({ AND: [{status:"pending"},{NOT:hasQuote},{NOT:hasOrder}] });
  else if (["cancelled","rejected"].includes(q.status)) clauses.push({status:q.status});
  const contains = {contains:q.search,mode:"insensitive" as const};
  return { ...(clauses.length ? {AND:clauses} : {}), ...(q.search ? {OR:[{rfqNumber:contains},{fabricName:contains},{buyer:{email:contains}},{buyer:{fullName:contains}}]} : {}),
    ...(q.from || q.to ? {createdAt:buyerDateRange(q)} : {}), ...(q.quantityMin !== undefined || q.quantityMax !== undefined ? {quantity:{gte:q.quantityMin,lte:q.quantityMax}} : {}) };
}
export function registryStatus(raw: string, quoted: boolean, ordered: boolean) {
  if (raw === "cancelled" || raw === "rejected") return raw;
  if (raw === "closed" || ordered) return "closed";
  if (quoted || raw === "quoted") return "quoted";
  return ["approved","active","open","in_progress"].includes(raw) ? "active" : raw;
}
export async function registry(query: unknown, client = prisma) {
  const q = registrySchema.parse(query), where = registryWhere(q);
  const [rows,total,zeroMatches] = await Promise.all([client.communicationRequest.findMany({where,...paging(q),select:{id:true,rfqNumber:true,fabricName:true,quantity:true,status:true,requesterRole:true,
    deliveryPincode:true,createdAt:true,buyer:{select:{fullName:true,email:true}},_count:{select:{matches:true}},
    matches:{where:{response:{isNot:null}},take:1,select:{response:{select:{id:true}}}},
  }}),client.communicationRequest.count({where}), client.communicationRequest.count({where:{AND:[where,{matches:{none:{}}}]}})]);
  const orders = rows.length ? await client.communicationRequest.findMany({where:{id:{in:rows.map(r=>r.id)},...hasOrder},select:{id:true}}) : [];
  return {summary:{totalRfqs:total,zeroMatches,withMatches:total-zeroMatches},rfqs:rows.map(({matches,...row}) => {const state=registryStatus(row.status,matches.length>0,orders.some(o=>o.id===row.id));return {...row,lifecycleStatus:state,displayStatus:{label:state,tone:"slate"}};}),...pageInfo(total,q)};
}
