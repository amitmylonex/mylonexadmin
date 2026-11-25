import {MetricCard} from "../../../components/admin/primitives";
import {TrackingFilters} from "../components/TrackingFilters";
import React, { useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { useAdminViewState } from "../../../hooks/useAdminViewState";
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
  const [from, setFrom] = useAdminViewState("tracking:from", ""),
    [to, setTo] = useAdminViewState("tracking:to", "");
  const [size,setSize]=useAdminViewState("tracking:size","25");
  const invalidRange=!!(from&&to&&(from>to||(new Date(to).getTime()-new Date(from).getTime())/86400000>366));
  const list = useAdminList<TrackingListItem>(
    "/api/v1/admin/rfq-tracking",
    "rows",
    { from, to, pageSize:size },
    {enabled:!invalidRange},
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
            <MetricCard key={m.key} label={m.label} value={list.data.summary[m.key]} hint={m.definition}/>
          ))}
        </div>
      )}
      <TrackingFilters list={list} from={from} to={to} onFrom={value=>{setFrom(value);list.setPage(1);}} onTo={value=>{setTo(value);list.setPage(1);}} size={size} onSize={value=>{setSize(value);list.setPage(1);}} onClear={()=>{setFrom("");setTo("");list.setSearch("");list.setStatus("");setSize("25");list.setPage(1);}}/>
      {invalidRange&&<p role="alert" className="text-sm text-red-700">Choose an ordered date range of at most 366 days.</p>}
      <ListFeedback list={list} />
      <div className="space-y-3 md:hidden">
        {list.items.map(r=><article key={r.id} className="rounded-2xl border border-border bg-white p-4 space-y-3">
          <button className="text-primary font-semibold text-left" onClick={()=>onSelectRfq?.(r.id)}>{r.rfqNumber}<span className="block text-sm font-normal text-muted">{r.fabricName} · {r.quantity.toLocaleString("en-IN")} m</span></button>
          <Status value={r.overallStatus}/><p className="text-xs text-muted">Inquired {date(r.createdAt)}</p>
          <p className="text-sm">{r.matchedSuppliers} matched · {r.eligibleSuppliers} eligible</p>
          <p className="text-xs leading-6">{r.counts.attempted} attempted · {r.counts.delivered} delivered · {r.counts.read} read<br/>{r.counts.quoted} quoted · {r.counts.declined} declined · {r.counts.failed} failed<br/>{r.counts.clarifying} clarifying · {r.counts.awaiting} awaiting · {r.counts.noResponse} no response</p>
        </article>)}
      </div>
      <div className="hidden md:block"><AdminTable
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
                  {r.fabricName} Â· {r.quantity.toLocaleString("en-IN")} m
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
                  {r.matchedSuppliers} suppliers Â· {r.eligibleSuppliers}{" "}
                  currently eligible
                </p>
              </>
            ),
          },
          {
            label: "Notification evidence",
            render: (r) => (
              <p className="text-xs leading-6">
                {r.counts.attempted} attempted Â· {r.counts.sent} sent Â· {r.counts.delivered} delivered Â·{" "}
                {r.counts.read} read
                <br />
                {r.counts.failed} failed Â· {r.counts.awaiting} awaiting
              </p>
            ),
          },
          {
            label: "Responses",
            render: (r) => (
              <p className="text-xs leading-6">
                {r.counts.quoted} quoted Â· {r.counts.declined} declined
                <br />
                {r.counts.clarifying} clarifying Â· {r.counts.noResponse} no
                response
              </p>
            ),
          },
          { label: "Created", render: (r) => date(r.createdAt) },
        ]}
      />
      </div>
      <Pagination list={list} />
      <p className="text-xs text-muted">
        Read receipts require retained receipt evidence; a quote alone is not a
        read receipt. As of {date(list.data?.asOf)}.
      </p>
    </div>
  );
}
