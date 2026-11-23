import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/query.js";
export const moderationQuerySchema = listQuerySchema.extend({ pageSize: z.coerce.number().int().min(1).max(25).default(10) });
export const approvalSchema = z.object({ note: z.string().trim().max(2000).optional() });
export const rejectionSchema = z.object({ reason: z.string().trim().min(1, "A rejection reason is required").max(2000) });
export const moderationBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50).refine(ids => new Set(ids).size === ids.length, "RFQ IDs must be unique"),
  decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(2000).optional(), note: z.string().trim().max(2000).optional(),
}).refine(input => input.decision !== "reject" || Boolean(input.reason), { path: ["reason"], message: "A rejection reason is required" });
export type ModerationQuery = z.infer<typeof moderationQuerySchema>;
export const matchingSpecSchema = z.object({ composition: z.string().max(5000), fabricStructure: z.string().max(100).optional(),
  data: z.object({ weaveType: z.string().max(200).optional(), knitType: z.string().max(200).optional(), gsm: z.number().positive().optional(),
    gsmMin: z.number().positive().optional(), gsmMax: z.number().positive().optional(), width: z.string().max(100).optional(),
    openWidthIn: z.number().positive().optional(), diaIn: z.number().positive().optional(), quantity: z.number().nonnegative().optional(),
    deliveryState: z.string().max(200).optional(), materialType: z.enum(["pure", "blend"]).optional(), blendComposition: z.string().max(5000).optional(),
    fabricState: z.string().max(100).optional(), yarnType: z.string().max(200).optional(),
    templateSpecs: z.array(z.object({ specKey: z.string().max(100), valueNum: z.number().finite().optional(), valueText: z.string().max(500).optional() })).max(50).optional(),
  }).passthrough(),
}).passthrough();
