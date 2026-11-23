import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { buyerDateRange, buyerPageInfo, type BuyerListQuery, type BuyerTab } from "./buyer.schema.js";
import { buyerOrders, buyerOrderSummary } from "./buyer-orders.repository.js";
export async function detail(id: string, tab: BuyerTab, q: BuyerListQuery, client = prisma) {
  const buyer = await client.user.findFirst({ where: { id, role: "BUYER" }, select: {
    id: true, email: true, fullName: true, createdAt: true,
    buyerProfile: { select: { id: true, company: true, phone: true, city: true, gstNumber: true, billingAddress: true } },
    _count: { select: { inquiries: true, communicationRequests: { where: { requesterRole: "BUYER" } }, samples: true, orders: true } },
  } });
  if (!buyer) return null;
  const summary = await buyerOrderSummary(id, client);
  const profile = { ...buyer, billingAddress: buyer.buyerProfile?.billingAddress ?? null,
    billingAddressStatus: buyer.buyerProfile?.billingAddress ? "recorded" as const : "not_recorded" as const };
  if (tab === "orders") return { buyer: profile, orderSummary: summary, ...await buyerOrders(id, q, client) };
  const contains = { contains: q.search, mode: "insensitive" as const };
  const paging = { take: q.pageSize, skip: (q.page - 1) * q.pageSize, orderBy: [{ createdAt: q.sort === "oldest" ? "asc" as const : "desc" as const }, { id: "asc" as const }] };
  if (tab === "rfqs") {
    const where: Prisma.CommunicationRequestWhereInput = { buyerId: id, requesterRole: "BUYER", createdAt: buyerDateRange(q),
      ...(q.search ? { OR: [{ rfqNumber: contains }, { fabricName: contains }] } : {}) };
    const [activity, total] = await Promise.all([client.communicationRequest.findMany({ where, ...paging,
      select: { id: true, rfqNumber: true, fabricName: true, quantity: true, status: true, createdAt: true } }), client.communicationRequest.count({ where })]);
    return { buyer: profile, orderSummary: summary, activity, ...buyerPageInfo(total, q) };
  }
  if (tab === "samples") {
    const where: Prisma.SampleWhereInput = { buyerId: id, createdAt: buyerDateRange(q), ...(q.search ? { OR: [{ sampleNumber: contains }, { fabricName: contains }] } : {}) };
    const [activity, total] = await Promise.all([client.sample.findMany({ where, ...paging,
      select: { id: true, sampleNumber: true, sampleType: true, fabricName: true, quantityMeters: true, status: true, createdAt: true,
        quoteSampleCostInr: true, quoteCourierCostInr: true, deliveredAt: true } }), client.sample.count({ where })]);
    return { buyer: profile, orderSummary: summary, activity, ...buyerPageInfo(total, q) };
  }
  // Preserve the previous accepted-production view for existing API consumers.
  const where: Prisma.CommunicationRequestResponseWhereInput = { status: "ACCEPTED_BY_BUYER", buyerDecision: "accepted",
    requestMatch: { communicationRequest: { buyerId: id, requesterRole: "BUYER" } } };
  const [activity, total] = await Promise.all([client.communicationRequestResponse.findMany({ where, ...paging,
    select: { id: true, price: true, leadTimeDays: true, status: true, createdAt: true, deliveredAt: true,
      supplier: { select: { companyName: true } }, requestMatch: { select: { communicationRequest: { select: { rfqNumber: true, fabricName: true, quantity: true } } } } } }),
    client.communicationRequestResponse.count({ where })]);
  return { buyer: profile, orderSummary: summary, activity, ...buyerPageInfo(total, q) };
}
