import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { buyerDateRange, buyerPaging, buyerPageInfo as pageInfo, type BuyerListQuery } from "./buyer.schema.js";
import { deriveBuyerEngagementStatus } from "./engagement.js";
import { metrics } from "./buyer-metrics.repository.js";
const openRfqs = ["pending", "open", "in_progress"];
const openSamples = ["requested", "in_progress", "dispatched"];
export async function list(q: BuyerListQuery, client = prisma) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const where: Prisma.UserWhereInput = {
    role: "BUYER",
    createdAt: buyerDateRange(q),
    ...(q.search
      ? {
          OR: [
            { fullName: contains },
            { email: contains },
            { buyerProfile: { company: contains } },
            { buyerProfile: { phone: contains } },
            { buyerProfile: { city: contains } },
          ],
        }
      : {}),
  };
  const [users, total, globalMetrics] = await Promise.all([
    client.user.findMany({
      where,
      ...buyerPaging(q),
      include: {
        buyerProfile: { select: { company: true, phone: true, city: true, gstNumber: true } },
        _count: {
          select: {
            communicationRequests: { where: { requesterRole: "BUYER" } },
            samples: true,
            inquiries: true,
            orders: true,
          },
        },
      },
    }),
    client.user.count({ where }),
    metrics(client),
  ]);
  const ids = users.map((u) => u.id);
  if (!ids.length)
    return { buyers: [], metrics: globalMetrics, ...pageInfo(total, q) };
  const [openR, openS, acceptedS, acceptedR, rfqActivity, sampleActivity] =
    await Promise.all([
      client.communicationRequest.groupBy({
        by: ["buyerId"],
        where: {
          buyerId: { in: ids },
          requesterRole: "BUYER",
          status: { in: openRfqs },
        },
        _count: { _all: true },
      }),
      client.sample.groupBy({
        by: ["buyerId"],
        where: { buyerId: { in: ids }, status: { in: openSamples } },
        _count: { _all: true },
      }),
      client.sample.groupBy({
        by: ["buyerId"],
        where: {
          buyerId: { in: ids },
          status: "accepted_by_buyer",
          buyerDecision: "accepted",
        },
        _count: { _all: true },
      }),
      client.$queryRaw<Array<{ buyerId: string; count: bigint }>>(
        Prisma.sql`SELECT r.buyer_id AS "buyerId",count(*) FROM communication_request_responses p JOIN communication_request_matches m ON m.id=p.request_match_id JOIN communication_requests r ON r.id=m.communication_request_id WHERE r.buyer_id IN (${Prisma.join(ids)}) AND r.requester_role='BUYER' AND p.status='ACCEPTED_BY_BUYER' AND p.buyer_decision='accepted' GROUP BY r.buyer_id`,
      ),
      client.communicationRequest.groupBy({
        by: ["buyerId"],
        where: { buyerId: { in: ids }, requesterRole: "BUYER" },
        _max: { updatedAt: true },
      }),
      client.sample.groupBy({
        by: ["buyerId"],
        where: { buyerId: { in: ids } },
        _max: { updatedAt: true },
      }),
    ]);
  const count = (rows: any[], id: string) =>
    rows.find((r) => r.buyerId === id)?._count?._all || 0;
  return {
    buyers: users.map((u) => {
      const acceptedOrderCount =
        count(acceptedS, u.id) +
        Number(acceptedR.find((r) => r.buyerId === u.id)?.count || 0);
      const counts = {
        rfqCount: u._count.communicationRequests,
        totalRfqs: u._count.communicationRequests,
        inquiryCount: u._count.inquiries,
        totalInquiries: u._count.inquiries,
        orderCount: u._count.orders,
        sampleCount: u._count.samples,
        openRfqCount: count(openR, u.id),
        openSampleCount: count(openS, u.id),
        acceptedOrderCount,
      };
      const dates = [
        rfqActivity.find((r) => r.buyerId === u.id)?._max.updatedAt,
        sampleActivity.find((r) => r.buyerId === u.id)?._max.updatedAt,
      ].filter(Boolean) as Date[];
      return {
        id: u.id,
        userId: u.id,
        company: u.buyerProfile?.company ?? null,
        fullName: u.fullName,
        email: u.email,
        phone: u.buyerProfile?.phone ?? null,
        city: u.buyerProfile?.city ?? null,
        gstNumber: u.buyerProfile?.gstNumber ?? null,
        createdAt: u.createdAt,
        ...counts,
        engagementStatus: deriveBuyerEngagementStatus(counts),
        lastActivityAt: dates.length
          ? new Date(Math.max(...dates.map((d) => d.getTime())))
          : null,
      };
    }),
    metrics: globalMetrics,
    ...pageInfo(total, q),
  };
}
