import { z } from "zod";
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().max(150).default(""),
  status: z.string().trim().max(80).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
export const idSchema = z.object({ id: z.string().uuid() });
export const decisionSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});
export const bulkDecisionSchema = decisionSchema.extend({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max(50)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Duplicate identifiers are not allowed",
    ),
  decision: z.enum(["forward", "reject"]),
});
export const pageInfo = (totalCount: number, q: ListQuery) => ({
  totalCount,
  page: q.page,
  pageSize: q.pageSize,
  totalPages: Math.max(1, Math.ceil(totalCount / q.pageSize)),
});
export const paging = (q: ListQuery) => ({
  take: q.pageSize,
  skip: (q.page - 1) * q.pageSize,
  orderBy: [
    { createdAt: q.sort === "oldest" ? ("asc" as const) : ("desc" as const) },
    { id: "asc" as const },
  ],
});
