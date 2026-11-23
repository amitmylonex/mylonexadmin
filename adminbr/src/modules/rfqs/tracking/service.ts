import { readWhatsAppQuoteMetadata } from "../../quotes/quote-metadata.js";
import { deriveAdminRfqStatus } from "../display-status.js";
import {
  trackingDetailQuerySchema,
  trackingIdSchema,
  trackingQuerySchema,
} from "./schema.js";
import {
  getTrackingDetailRecord,
  getTrackingWebhookRecords,
  listTrackingRecords,
} from "./repo.js";
import {
  projectTrackingListItem,
  projectTrackingSupplier,
} from "./projection.js";
import { lifecycleSteps, evidenceStatus } from "./lifecycle.js";
import type { TrackingDetail, TrackingList } from "./types.js";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: { code: string; message: string } };
export async function getRfqTracking(
  rawQuery: unknown,
): Promise<Result<TrackingList>> {
  try {
    const parsed = trackingQuerySchema.safeParse(rawQuery);
    if (!parsed.success)
      return {
        ok: false,
        status: 400,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues.map((issue) => issue.message).join(". "),
        },
      };
    const now = new Date();
    const { records, summary } = await listTrackingRecords(parsed.data, now);
    return {
      ok: true,
      data: {
        rows: records.map((record) =>
          projectTrackingListItem(record, record.matches, now),
        ),
        summary,
        total: summary.inquiries,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        asOf: now.toISOString(),
      },
    };
  } catch {
    console.error(
      "[rfq-tracking] Overview read failed; request data and provider payloads withheld",
    );
    return {
      ok: false,
      status: 500,
      error: {
        code: "INTERNAL_ERROR",
        message: "RFQ tracking could not be loaded. Retry using Refresh.",
      },
    };
  }
}
export async function getRfqTrackingDetail(
  rawId: unknown,
  rawQuery: unknown,
): Promise<Result<TrackingDetail>> {
  try {
    const id = trackingIdSchema.safeParse(rawId);
    const query = trackingDetailQuerySchema.safeParse(rawQuery);
    if (!id.success || !query.success)
      return {
        ok: false,
        status: 400,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid RFQ identifier or page",
        },
      };
    const record = await getTrackingDetailRecord(id.data, query.data.page);
    if (!record)
      return {
        ok: false,
        status: 404,
        error: { code: "NOT_FOUND", message: "Buyer RFQ not found" },
      };
    const now = new Date();
    const inboundIds = record.matches.flatMap((match) => {
      const metadata = readWhatsAppQuoteMetadata(
        match.response?.additionalNotes,
      );
      return metadata ? [metadata.inboundMessageId] : [];
    });
    const events = await getTrackingWebhookRecords(inboundIds);
    const projected = projectTrackingListItem(
      record.inquiry,
      record.matches,
      now,
    );
    const overall = evidenceStatus(record.evidence);
    const inquiry = {
      id: projected.id,
      rfqNumber: projected.rfqNumber,
      fabricName: projected.fabricName,
      quantity: projected.quantity,
      createdAt: projected.createdAt,
      recordedStatus: projected.recordedStatus,
      overallStatus: overall.label,
      overallTone: overall.tone,
    };
    return {
      ok: true,
      data: {
        inquiry,
        lifecycle: lifecycleSteps(record.inquiry, record.evidence),
        suppliers: record.matches.map((match) => {
          const metadata = readWhatsAppQuoteMetadata(
            match.response?.additionalNotes,
          );
          return projectTrackingSupplier(
            record.inquiry,
            match,
            now,
            events.find((event) => event.id === metadata?.inboundMessageId),
          );
        }),
        totalMatches: record.total,
        page: query.data.page,
        pageSize: 25,
        asOf: now.toISOString(),
      },
    };
  } catch {
    console.error(
      "[rfq-tracking] Detail read failed; request data and provider payloads withheld",
    );
    return {
      ok: false,
      status: 500,
      error: {
        code: "INTERNAL_ERROR",
        message: "RFQ detail could not be loaded. Retry using Refresh.",
      },
    };
  }
}
