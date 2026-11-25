import { z } from "zod";
import * as repo from "./rfq.repository.js";
import { deriveAdminRfqStatus } from "./display-status.js";
import { PublicError } from "../../common/errors/public-error.js";
import { notificationStatus } from "../notifications/notification-status.js";
import {
  listQuerySchema,
  bulkDecisionSchema,
  idSchema,
  decisionSchema,
} from "../../common/pagination/query.js";
export async function listRfqs(query: unknown) {
  const result = await repo.listRfqs(listQuerySchema.parse(query));
  return {
    ...result,
    rfqs: result.rfqs.map((r) => ({
      ...r,
      displayStatus: deriveAdminRfqStatus(r.matches),
    })),
  };
}
export const listPendingMatches = (query: unknown) =>
  repo.listPendingMatches(listQuerySchema.parse(query));
export async function detail(id: unknown, query: unknown) {
  const result = await repo.rfqDetail(
    idSchema.parse({ id }).id,
    listQuerySchema.parse(query),
  );
  if (!result) throw new PublicError(404, "RFQ not found");
  return result;
}
export async function decide(
  id: unknown,
  decision: "forward" | "reject",
  body: unknown,
  actor: string,
) {
  const input = decisionSchema.strict().parse(body || {});
  const result = await repo.decideMatches(
    [idSchema.parse({ id }).id],
    decision,
    actor,
    input.note,
  );
  if (!result.changedCount && !result.alreadyReviewedCount)
    throw new PublicError(
      409,
      result.failures[0]?.message || "Match is no longer pending or supplier is not approved. Refresh the queue.",
    );
  return {
    ok: true,
    ...result,
    notification: result.notification,
  };
}
export async function bulk(body: unknown, actor: string) {
  const input = bulkDecisionSchema.strict().parse(body);
  return {
    ok: true,
    ...(await repo.decideMatches(input.ids, input.decision, actor, input.note)),

  };
}
export { manualRoute as manual } from "./tracking/actions.js";
