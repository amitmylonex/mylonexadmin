import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { buyerDateRange, buyerPageInfo, type BuyerListQuery } from "./buyer.schema.js";
import { orderEstimate } from "./buyer-order-values.js";
export async function buyerOrderSummary(id: string, client = prisma) {
  const rows = await client.$queryRaw<Array<{ total: bigint; production: bigint; sampling: bigint; valued: bigint; amount: Prisma.Decimal | null }>>(Prisma.sql`
    WITH scoped AS (
      SELECT o.order_type, CASE
        WHEN o.order_type = 'production' THEN CASE
          WHEN btrim(p.total_value_estimate->>'total') ~ '^[0-9]+([.][0-9]+)?$'
            THEN (btrim(p.total_value_estimate->>'total'))::numeric
          ELSE p.price * r.quantity END
        WHEN o.order_type = 'sampling' AND s.quote_sample_cost_inr IS NOT NULL
          THEN s.quote_sample_cost_inr + COALESCE(s.quote_courier_cost_inr, 0)
        ELSE NULL END AS amount
      FROM orders o
      LEFT JOIN communication_request_responses p ON p.id = o.response_id
      LEFT JOIN communication_request_matches m ON m.id = p.request_match_id
      LEFT JOIN communication_requests r ON r.id = m.communication_request_id
      LEFT JOIN samples s ON s.id = o.sample_id
      WHERE o.buyer_id = ${id}
    )
    SELECT count(*) AS total, count(*) FILTER (WHERE order_type = 'production') AS production,
      count(*) FILTER (WHERE order_type = 'sampling') AS sampling,
      count(amount) AS valued, sum(round(amount, 2)) AS amount FROM scoped`);
  const result = rows[0];
  const totalCount = Number(result?.total ?? 0), valuedOrderCount = Number(result?.valued ?? 0);
  return { totalCount, productionCount: Number(result?.production ?? 0), sampleCount: Number(result?.sampling ?? 0),
    valuedOrderCount, unknownValueCount: totalCount - valuedOrderCount,
    totalValueEstimateInr: result?.amount != null ? new Prisma.Decimal(result.amount).toFixed(2) : totalCount === 0 ? "0.00" : null,
    currency: "INR", basis: "Actual orders only; recorded quote totals or production rate × quantity, and sample cost plus courier. Estimates are not payment receipts." };
}
export async function buyerOrders(id: string, q: BuyerListQuery, client = prisma) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const where: Prisma.OrderWhereInput = { buyerId: id, createdAt: buyerDateRange(q),
    ...(q.search ? { OR: [{ orderNumber: contains }, { response: { requestMatch: { communicationRequest: { fabricName: contains } } } }, { sample: { fabricName: contains } }] } : {}) };
  const [orders, total] = await Promise.all([client.order.findMany({ where, take: q.pageSize, skip: (q.page - 1) * q.pageSize,
    orderBy: [{ createdAt: q.sort === "oldest" ? "asc" : "desc" }, { id: "asc" }],
    select: { id: true, orderNumber: true, orderType: true, status: true, createdAt: true,
      response: { select: { price: true, totalValueEstimate: true, requestMatch: { select: { communicationRequest: { select: { fabricName: true, quantity: true } } } } } },
      sample: { select: { fabricName: true, quoteSampleCostInr: true, quoteCourierCostInr: true } },
    } }), client.order.count({ where })]);
  return { activity: orders.map(row => ({ id: row.id, orderNumber: row.orderNumber, orderType: row.orderType, status: row.status, createdAt: row.createdAt,
    fabricName: row.response?.requestMatch.communicationRequest.fabricName ?? row.sample?.fabricName ?? null,
    totalValueEstimate: orderEstimate(row) })), ...buyerPageInfo(total, q) };
}
