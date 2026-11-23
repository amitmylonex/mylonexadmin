import { Prisma } from "@prisma/client";
export function orderEstimate(row: { orderType: string; response?: any; sample?: any }): string | null {
  if (row.orderType === "production" && row.response) {
    const stored = row.response.totalValueEstimate?.total;
    if (stored !== undefined && stored !== null && /^\d+(?:\.\d+)?$/.test(String(stored).trim())) return new Prisma.Decimal(String(stored).trim()).toFixed(2);
    const quantity = row.response.requestMatch?.communicationRequest?.quantity;
    if (row.response.price != null && quantity != null) return new Prisma.Decimal(String(row.response.price)).mul(quantity).toFixed(2);
  }
  if (row.orderType === "sampling" && row.sample?.quoteSampleCostInr != null) return new Prisma.Decimal(String(row.sample.quoteSampleCostInr)).add(String(row.sample.quoteCourierCostInr ?? 0)).toFixed(2);
  return null;
}
