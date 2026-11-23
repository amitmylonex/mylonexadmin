import { prisma } from "../../infrastructure/db.js";
export async function originalMetrics() {
  const [
    legacyInquiries,
    legacyResponses,
    rfqInquiries,
    rfqResponses,
    averages,
  ] = await Promise.all([
    prisma.inquiry.count(),
    prisma.inquiryResponse.count(),
    prisma.communicationRequest.count(),
    prisma.communicationRequestResponse.count(),
    prisma.$queryRaw<
      Array<{ hours: number | null }>
    >`SELECT AVG(hours)::float8 AS hours FROM (SELECT GREATEST(EXTRACT(EPOCH FROM (r."createdAt"-m."createdAt"))/3600,0) AS hours FROM "InquiryResponse" r JOIN "InquiryMatch" m ON m.id=r."inquiryMatchId" UNION ALL SELECT GREATEST(EXTRACT(EPOCH FROM (r.created_at-m.created_at))/3600,0) FROM communication_request_responses r JOIN communication_request_matches m ON m.id=r.request_match_id) timings`,
  ]);
  return {
    legacyInquiries,
    legacyResponses,
    rfqInquiries,
    rfqResponses,
    totalInquiries: legacyInquiries + rfqInquiries,
    totalResponses: legacyResponses + rfqResponses,
    avgResponseTimeHours: averages[0]?.hours || 0,
  };
}

export async function moderationMetrics() {
  const [
    totalSuppliers,
    pendingSuppliers,
    approvedSuppliers,
    suspendedSuppliers,
    totalBuyers,
    totalCurrentRfqs,
    totalLegacyInquiries,
    totalSamples,
    totalOrders,
    recentPending,
  ] = await Promise.all([
    prisma.supplierProfile.count(),
    prisma.supplierProfile.count({ where: { status: "PENDING" } }),
    prisma.supplierProfile.count({ where: { status: "APPROVED" } }),
    prisma.supplierProfile.count({ where: { status: "SUSPENDED" } }),
    prisma.buyerProfile.count(),
    prisma.communicationRequest.count(),
    prisma.inquiry.count(),
    prisma.sample.count(),
    prisma.order.count(),
    prisma.supplierProfile.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        companyName: true,
        city: true,
        phone: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    metrics: {
      suppliers: {
        total: totalSuppliers,
        pending: pendingSuppliers,
        approved: approvedSuppliers,
        suspended: suspendedSuppliers,
      },
      buyers: {
        total: totalBuyers,
      },
      rfqs: {
        totalCurrent: totalCurrentRfqs,
        totalLegacyInquiries: totalLegacyInquiries,
      },
      samples: {
        total: totalSamples,
      },
      orders: {
        total: totalOrders,
      },
    },
    recentPending: recentPending.map((s) => ({
      id: s.id,
      companyName: s.companyName,
      city: s.city,
      phone: s.phone,
      createdAt: s.createdAt,
      userEmail: s.user.email,
    })),
  };
}
