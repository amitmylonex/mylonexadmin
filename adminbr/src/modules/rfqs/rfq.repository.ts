import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { ListQuery, paging, pageInfo } from "../../common/pagination/query.js";
export const party = { id: true, email: true, fullName: true } as const;
export const supplierSelect = {
  id: true,
  companyName: true,
  city: true,
  phone: true,
  status: true,
  user: { select: party },
} as const;
export const matchSelect = {
  id: true,
  communicationRequestId: true,
  supplierId: true,
  sourceType: true,
  sourceId: true,
  score: true,
  explanation: true,
  status: true,
  createdAt: true,
  adminReviewedAt: true,
  adminReviewedByUserId: true,
  adminReviewNote: true,
  forwardedAt: true,
  supplier: { select: supplierSelect },
  response: {
    select: {
      id: true,
      price: true,
      status: true,
      buyerDecision: true,
      leadTimeDays: true,
      moq: true,
      quoteType: true,
      supplierOriginalPrice: true,
    },
  },
} satisfies Prisma.CommunicationRequestMatchSelect;
export async function listRfqs(q: ListQuery) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const where: Prisma.CommunicationRequestWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.search
      ? {
          OR: [
            { rfqNumber: contains },
            { fabricName: contains },
            { buyer: { email: contains } },
          ],
        }
      : {}),
  };
  const [rfqs, total] = await Promise.all([
    prisma.communicationRequest.findMany({
      where,
      ...paging(q),
      include: {
        buyer: { select: party },
        _count: { select: { matches: true } },
      },
    }),
    prisma.communicationRequest.count({ where }),
  ]);
  const matches = rfqs.length
    ? await prisma.communicationRequestMatch.findMany({
        where: { communicationRequestId: { in: rfqs.map((r) => r.id) } },
        select: {
          id: true,
          communicationRequestId: true,
          status: true,
          response: { select: { id: true, status: true, buyerDecision: true } },
        },
      })
    : [];
  return {
    rfqs: rfqs.map((r) => ({
      ...r,
      matches: matches.filter((m) => m.communicationRequestId === r.id),
    })),
    ...pageInfo(total, q),
  };
}
export async function rfqDetail(id: string, q: ListQuery) {
  const rfq = await prisma.communicationRequest.findUnique({
    where: { id },
    include: {
      buyer: { select: party },
      _count: { select: { matches: true } },
    },
  });
  if (!rfq) return null;
  const matches = await prisma.communicationRequestMatch.findMany({
    where: { communicationRequestId: id },
    ...paging(q),
    orderBy: [{ score: "desc" }, { id: "asc" }],
    select: matchSelect,
  });
  return { rfq: { ...rfq, matches }, ...pageInfo(rfq._count.matches, q) };
}
export async function listPendingMatches(q: ListQuery) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const where: Prisma.CommunicationRequestMatchWhereInput = {
    status: "PENDING_ADMIN_REVIEW",
    ...(q.search
      ? {
          OR: [
            { supplier: { companyName: contains } },
            { communicationRequest: { fabricName: contains } },
            { communicationRequest: { rfqNumber: contains } },
          ],
        }
      : {}),
  };
  const [matches, total] = await Promise.all([
    prisma.communicationRequestMatch.findMany({
      where,
      ...paging(q),
      select: {
        ...matchSelect,
        communicationRequest: {
          select: {
            id: true,
            rfqNumber: true,
            fabricName: true,
            quantity: true,
            deliveryPincode: true,
            requesterRole: true,
            buyer: { select: party },
          },
        },
      },
    }),
    prisma.communicationRequestMatch.count({ where }),
  ]);
  return { matches, ...pageInfo(total, q) };
}
export async function decideMatches(
  ids: string[],
  decision: "forward" | "reject",
  actor: string,
  note?: string,
) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.communicationRequestMatch.updateMany({
      where: {
        id: { in: ids },
        status: "PENDING_ADMIN_REVIEW",
        ...(decision === "forward" ? { supplier: { status: "APPROVED" } } : {}),
      },
      data: {
        status:
          decision === "forward"
            ? "FORWARDED_TO_SUPPLIER"
            : "REJECTED_BY_ADMIN",
        adminReviewedAt: new Date(),
        adminReviewedByUserId: actor,
        adminReviewNote: note || null,
        ...(decision === "forward" ? { forwardedAt: new Date() } : {}),
      },
    });
    return { changedCount: changed.count, requestedCount: ids.length };
  });
}
