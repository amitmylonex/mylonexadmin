import { z } from "zod";
const day = z.preprocess(value => value === "" ? undefined : value, z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => { const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, "Enter a valid calendar date").optional());
const baseQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().max(150).default(""), from: day, to: day,
  sort: z.enum(["newest", "oldest", "name-asc", "name-desc"]).default("newest"),
});
const orderedDates = (query: { from?: string; to?: string }) => !query.from || !query.to || query.from <= query.to;
export const buyerListSchema = baseQuery.refine(orderedDates, { path: ["to"], message: "End date must follow start date" });
export const buyerDetailSchema = baseQuery.extend({ tab: z.enum(["rfqs", "samples", "orders", "production"]).default("rfqs"), sort: z.enum(["newest", "oldest"]).default("newest") })
  .refine(orderedDates, { path: ["to"], message: "End date must follow start date" });
export type BuyerListQuery = z.infer<typeof buyerListSchema>;
export type BuyerTab = z.infer<typeof buyerDetailSchema>["tab"];
export function buyerDateRange(query: { from?: string; to?: string }) {
  // Date filters represent complete calendar days in the admin's India timezone.
  return query.from || query.to ? {
    ...(query.from ? { gte: new Date(`${query.from}T00:00:00+05:30`) } : {}),
    ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00+05:30`).getTime() + 86400000) } : {}),
  } : undefined;
}
export function buyerPaging(q: BuyerListQuery) {
  return { take: q.pageSize, skip: (q.page - 1) * q.pageSize,
    orderBy: q.sort.startsWith("name-")
      ? [{ fullName: { sort: q.sort === "name-asc" ? "asc" as const : "desc" as const, nulls: "last" as const } }, { email: "asc" as const }, { id: "asc" as const }]
      : [{ createdAt: q.sort === "oldest" ? "asc" as const : "desc" as const }, { id: "asc" as const }],
  };
}
export const buyerPageInfo = (totalCount: number, q: BuyerListQuery) => ({ totalCount, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(totalCount / q.pageSize)) });
