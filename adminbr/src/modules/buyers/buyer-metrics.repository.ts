import { prisma } from "../../infrastructure/db.js";
import { MemoryCache } from "../../shared/cache/ttl-cache.js";
const cache = new MemoryCache(1);
const openRfqs = ["pending", "open", "in_progress"];
const openSamples = ["requested", "in_progress", "dispatched"];
export async function metrics(client = prisma) {
  return client === prisma ? cache.remember("buyers", 15_000, () => readMetrics(client)) : readMetrics(client);
}
async function readMetrics(client: typeof prisma) {
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
