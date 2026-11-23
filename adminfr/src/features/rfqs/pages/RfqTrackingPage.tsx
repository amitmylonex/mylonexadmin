import React, { useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import {
  PageHeading,
  QueryToolbar,
  ListFeedback,
  AdminTable,
  Pagination,
  Status,
  date,
} from "../../../components/tables/AdminTable";
import { TRACKING_METRICS } from "../tracking-metrics";
import type { TrackingListItem } from "../../../contracts/rfq-tracking";
export function RfqTrackingPage({
  onSelectRfq,
}: {
  onSelectRfq?: (id: string) => void;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const list = useAdminList<TrackingListItem>(
    "/api/v1/admin/rfq-tracking",
    "rows",
    { from, to },
  );
  return (
    <div className="space-y-6">
      <PageHeading
        title="RFQ Tracking"
        description="Track buyer quote inquiries, retained notification delivery evidence and supplier responses."
      />
      {list.data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {TRACKING_METRICS.map((m) => (
            <article key={m.key} className="card p-4" title={m.definition}>
              <p className="text-xs text-muted">{m.label}</p>
              <strong className="block text-2xl mt-2">
                {list.data.summary[m.key]}
              </strong>
            </article>
          ))}
        </div>
      )}
      <QueryToolbar
        list={list}
        statuses={[
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
        ].map((value) => ({ value, label: value.replace(/-/g, " ") }))}
      />
      <div className="flex flex-wrap gap-4 text-xs">
        <label>
          From (UTC inquiry date)
          <input
            className="input mt-1"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              list.setPage(1);
            }}
          />
        </label>
        <label>
          To (UTC inquiry date)
          <input
            className="input mt-1"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              list.setPage(1);
            }}
          />
        </label>
      </div>
      <ListFeedback list={list} />
      <AdminTable
        items={list.items}
        columns={[
          {
            label: "Inquiry",
            render: (r) => (
              <button
                className="text-primary text-left font-semibold"
                onClick={() => onSelectRfq?.(r.id)}
              >
                {r.rfqNumber}
                <p className="text-xs font-normal text-muted">
                  {r.fabricName} · {r.quantity} m
                </p>
              </button>
            ),
          },
          {
            label: "Progress",
            render: (r) => (
              <>
                <Status value={r.overallStatus} />
                <p className="text-xs text-muted mt-2">
                  {r.matchedSuppliers} suppliers · {r.eligibleSuppliers}{" "}
                  currently eligible
                </p>
              </>
            ),
          },
          {
            label: "Notification evidence",
            render: (r) => (
              <p className="text-xs leading-6">
                {r.counts.sent} sent · {r.counts.delivered} delivered ·{" "}
                {r.counts.read} read
                <br />
                {r.counts.failed} failed · {r.counts.awaiting} awaiting
              </p>
            ),
          },
          {
            label: "Responses",
            render: (r) => (
              <p className="text-xs leading-6">
                {r.counts.quoted} quoted · {r.counts.declined} declined
                <br />
                {r.counts.clarifying} clarifying · {r.counts.noResponse} no
                response
              </p>
            ),
          },
          { label: "Created", render: (r) => date(r.createdAt) },
        ]}
      />
      <Pagination list={list} />
      <p className="text-xs text-muted">
        Read receipts require retained receipt evidence; a quote alone is not a
        read receipt. As of {date(list.data?.asOf)}.
      </p>
    </div>
  );
}
