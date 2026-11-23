import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { ListQuery, paging, pageInfo } from "../../common/pagination/query.js";
import { party, supplierSelect } from "../rfqs/rfq.repository.js";
export async function accepted(kind: "production" | "sampling", q: ListQuery, client = prisma) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  if (kind === "production") {
    const where: Prisma.CommunicationRequestResponseWhereInput = {
      status: "ACCEPTED_BY_BUYER",
      buyerDecision: "accepted",
      ...(q.status === "delivered"
        ? { deliveredAt: { not: null } }
        : q.status === "pending"
          ? { deliveredAt: null }
          : {}),
      ...(q.search
        ? {
            OR: [
              { supplier: { companyName: contains } },
              {
                requestMatch: { communicationRequest: { rfqNumber: contains } },
              },
              {
                requestMatch: {
                  communicationRequest: { fabricName: contains },
                },
              },
            ],
          }
        : {}),
    };
    const [orders, total] = await Promise.all([
      client.communicationRequestResponse.findMany({
        where,
        ...paging(q),
        include: {
          supplier: { select: supplierSelect },
          requestMatch: {
            select: {
              communicationRequest: {
                select: {
                  id: true,
                  rfqNumber: true,
                  fabricName: true,
                  quantity: true,
                  deliveryPincode: true,
                  buyer: { select: party },
                },
              },
            },
          },
        },
      }),
      client.communicationRequestResponse.count({ where }),
    ]);
    return { orders, ...pageInfo(total, q) };
  }
  const where: Prisma.SampleWhereInput = {
    status: {in:["accepted_by_buyer","delivered"]},
    buyerDecision: "accepted",
    ...(q.status === "delivered"
      ? { deliveredAt: { not: null } }
      : q.status === "pending"
        ? { deliveredAt: null }
        : {}),
    ...(q.search
      ? {
          OR: [
            { sampleNumber: contains },
            { fabricName: contains },
            { buyer: { email: contains } },
          ],
        }
      : {}),
  };
  const [orders, total] = await Promise.all([
    client.sample.findMany({
      where,
      ...paging(q),
      include: { buyer: { select: party } },
    }),
    client.sample.count({ where }),
  ]);
  return { orders, ...pageInfo(total, q) };
}
export async function legacy(q: ListQuery) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const where: Prisma.OrderWhereInput = {
    ...(q.search
      ? {
          OR: [
            { orderNumber: contains },
            { supplier: { companyName: contains } },
            { buyer: { email: contains } },
          ],
        }
      : {}),
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      ...paging(q),
      include: {
        buyer: { select: party },
        supplier: { select: supplierSelect },
        response: {
          select: {
            id: true,
            price: true,
            requestMatch: {
              select: {
                communicationRequest: {
                  select: { fabricName: true, quantity: true },
                },
              },
            },
          },
        },
        sample: true,
        milestones: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, ...pageInfo(total, q) };
}
export const delivered = (kind:"production",id:string,actor:string) => prisma.communicationRequestResponse.updateMany({where:{id,status:"ACCEPTED_BY_BUYER",buyerDecision:"accepted",deliveredAt:null},data:{deliveredAt:new Date(),deliveredByUserId:actor}});
