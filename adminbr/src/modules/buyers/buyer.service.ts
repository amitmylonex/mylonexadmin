import { idSchema } from "../../common/pagination/query.js";
import { PublicError } from "../../common/errors/public-error.js";
import { buyerListSchema, buyerDetailSchema } from "./buyer.schema.js";
import * as repo from "./buyer.repository.js";
import { readBuyerVerification } from "./buyer-verification.js";
export const list = (query: unknown, storage = repo) => storage.list(buyerListSchema.parse(query));
export async function detail(params: unknown, query: unknown, storage = repo, verify = readBuyerVerification) {
  const { id } = idSchema.parse(params);
  const input = buyerDetailSchema.parse(query ?? {});
  const result = await storage.detail(id, input.tab, input);
  if (!result) throw new PublicError(404, "Buyer not found");
  return { ...result, tab: input.tab, buyer: { ...result.buyer, verification: await verify(id, result.buyer.email) } };
}
