import { z } from "zod";

export const TRACKING_FILTERS = [
  "all",
  "not-attempted",
  "sending",
  "sent",
  "delivered",
  "read",
  "quoted",
  "declined",
  "clarifying",
  "failed",
  "no-response",
  "no-matches",
] as const;
const date = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((value) => {
      const parsed = new Date(value + "T00:00:00Z");
      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    }, "Enter a valid date")
    .optional(),
);
export const trackingQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional().default(""),
    status: z.enum(TRACKING_FILTERS).default("all"),
    from: date,
    to: date,
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce
      .number()
      .refine((value) => [10, 25, 50].includes(value), "Choose 10, 25 or 50")
      .default(25),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "End date must follow start date",
  });
export const trackingIdSchema = z.string().uuid("Invalid RFQ identifier");
export const trackingDetailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type TrackingQuery = z.infer<typeof trackingQuerySchema>;
