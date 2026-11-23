import { prisma } from "../../infrastructure/db.js";
const openRfqs = ["pending", "open", "in_progress"];
const openSamples = ["requested", "in_progress", "dispatched"];
export async function metrics(client = prisma) {
  const now = Date.now();
  const [
    totalBuyers,
    signups7d,
    signups30d,
    acceptedProduction,
    acceptedSamples,
    buyersWithOpenActivity,
  ] = await Promise.all([
    client.user.count({ where: { role: "BUYER" } }),
    client.user.count({
      where: {
        role: "BUYER",
        createdAt: { gte: new Date(now - 7 * 86400000) },
      },
    }),
    client.user.count({
      where: {
        role: "BUYER",
        createdAt: { gte: new Date(now - 30 * 86400000) },
      },
    }),
    client.communicationRequestResponse.count({
      where: { status: "ACCEPTED_BY_BUYER", buyerDecision: "accepted" },
    }),
    client.sample.count({
      where: { status: "accepted_by_buyer", buyerDecision: "accepted" },
    }),
    client.user.count({
      where: {
        role: "BUYER",
        OR: [
          {
            communicationRequests: {
              some: { requesterRole: "BUYER", status: { in: openRfqs } },
            },
          },
          { samples: { some: { status: { in: openSamples } } } },
        ],
      },
    }),
  ]);
  return {
    totalBuyers,
    signups7d,
    signups30d,
    acceptedProduction,
    acceptedSamples,
    acceptedOrdersTotal: acceptedProduction + acceptedSamples,
    buyersWithOpenActivity,
  };
}
