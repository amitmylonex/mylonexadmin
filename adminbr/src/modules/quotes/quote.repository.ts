import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { ListQuery, paging, pageInfo } from "../../common/pagination/query.js";
import { party, supplierSelect } from "../rfqs/rfq.repository.js";
export async function listPending(q: ListQuery, client = prisma) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const where: Prisma.CommunicationRequestResponseWhereInput = {
    status: "PENDING_ADMIN_REVIEW",
    ...(q.search
      ? {
          OR: [
            { supplier: { companyName: contains } },
            {
              requestMatch: { communicationRequest: { fabricName: contains } },
            },
            { requestMatch: { communicationRequest: { rfqNumber: contains } } },
          ],
        }
      : {}),
  };
  const [quotes, total] = await Promise.all([
    client.communicationRequestResponse.findMany({
      where,
      ...paging(q),
      include: {
        supplier: { select: supplierSelect },
        requestMatch: {
          select: {
            id: true,
            communicationRequest: {
              select: {
                id: true,
                rfqNumber: true,
                fabricName: true,
                quantity: true,
                targetPriceMin: true,
                targetPriceMax: true,
                buyer: { select: party },
              },
            },
          },
        },
      },
    }),
    client.communicationRequestResponse.count({ where }),
  ]);
  return { quotes, ...pageInfo(total, q) };
}
export async function reviewLocked(
  id: string,
  build: (
    existing: any,
  ) => Prisma.CommunicationRequestResponseUncheckedUpdateManyInput,
  client = prisma,
) {
  return client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM public.communication_request_responses WHERE id=${id} FOR UPDATE`;
    const existing = await tx.communicationRequestResponse.findFirst({
      where: { id, status: "PENDING_ADMIN_REVIEW" },
    });
    if (!existing) return null;
    const changed = await tx.communicationRequestResponse.updateMany({
      where: { id, status: "PENDING_ADMIN_REVIEW" },
      data: build(existing),
    });
    return changed.count ? { id } : null;
  });
}
