import {delivered as sampleDelivered} from "../samples/sample-delivery.js";
import { z } from "zod";
import { listQuerySchema, idSchema } from "../../common/pagination/query.js";
import { PublicError } from "../../common/errors/public-error.js";
import * as repo from "./order.repository.js";
const kindSchema = z.enum(["production", "sampling"]);
export const list = (query: unknown) =>
  repo.legacy(listQuerySchema.parse(query));
export const accepted = (kind: unknown, query: unknown) =>
  repo.accepted(kindSchema.parse(kind), listQuerySchema.parse(query));
export async function deliver(params: unknown, actor: string, body?: unknown) {
  const { id } = idSchema.parse(params);
  const kind = kindSchema.parse((params as any).kind);
  if(kind === "sampling")return sampleDelivered(id,body,actor);
  const result = await repo.delivered(kind, id, actor);
  if (!result.count)
    throw new PublicError(409, "Accepted order not found or already delivered");
  return { ok: true };
}
