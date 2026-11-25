import React, {useState} from "react";
import { useAdminViewState } from "../../../hooks/useAdminViewState";
import { useAdminList } from "../../../hooks/useAdminList";
import {
  AdminTable,
  PageHeading,
  QueryToolbar,
  ListFeedback,
  Pagination,
  Status,
  date,
} from "../../../components/tables/AdminTable";
export function AllRfqsPage({
  onSelectRfq,
  onTrackRfq,
}: {
  onSelectRfq?: (id: string) => void;
  onTrackRfq?: (id:string)=>void;
}) {
  const [filters,setFilters]=useAdminViewState("rfqs:filters",{from:"",to:"",quantityMin:"",quantityMax:""});
  const list = useAdminList("/api/v1/admin/rfqs", "rfqs",filters);
  const change=(key:string,value:string)=>{setFilters(previous=>({...previous,[key]:value}));list.setPage(1);};
  return (
    <div className="space-y-6">
      <PageHeading
        title="All RFQs"
        description="Review requester requirements, supplier matches and quote progress."
      />
      {list.data?.summary&&<section aria-label="Sourcing summary" className="grid sm:grid-cols-3 gap-4">{[["Total RFQs",list.data.summary.totalRfqs],["Zero Matches (Sourcing)",list.data.summary.zeroMatches],["With Matches",list.data.summary.withMatches]].map(([label,count])=><article key={label} className="card p-5"><p className="text-xs text-muted">{label}</p><strong className="text-2xl">{Number(count).toLocaleString("en-IN")}</strong></article>)}</section>}
      <QueryToolbar
        list={list}

      />
      <div className="flex flex-wrap gap-2" aria-label="RFQ status filters">{["all","pending","active","quoted","closed","cancelled","rejected"].map(state=><button key={state} className="btn-outline text-xs" aria-pressed={(list.status || "all")===state} onClick={()=>list.setStatus(state==="all"?"":state)}>{state}</button>)}</div>
      <div className="card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[{key:"from",label:"Submitted from (IST)",type:"date"},{key:"to",label:"Submitted through (IST)",type:"date"},{key:"quantityMin",label:"Minimum quantity (m)",type:"number"},{key:"quantityMax",label:"Maximum quantity (m)",type:"number"}].map(field=><label key={field.key} className="text-xs">{field.label}<input className="input mt-1" type={field.type} min={field.type==="number"?0:undefined} value={filters[field.key as keyof typeof filters]} onChange={e=>change(field.key,e.target.value)} /></label>)}</div>
      <ListFeedback list={list} />
      <AdminTable
        items={list.items}
        columns={[
          {
            label: "RFQ",
            render: (r) => (
              <button
                className="text-primary font-semibold"
                onClick={() => onSelectRfq?.(r.id)}
              >
                {r.rfqNumber}
              </button>
            ),
          },
          {
            label: "Requester",
            render: (r) => (
              <>
                {r.buyer.fullName || r.buyer.email}
                <p className="text-xs text-muted">
                  {r.buyer.email} · {r.requesterRole}
                </p>
              </>
            ),
          },
          {
            label: "Fabric / quantity",
            render: (r) => (
              <>
                {r.fabricName}
                <p className="text-xs text-muted">
                  {r.quantity.toLocaleString("en-IN")} m · {r.deliveryPincode}
                </p>
              </>
            ),
          },
          {
            label: "Progress",
            render: (r) => (
              <>
                <Status value={r.displayStatus.label} />
                <p className="text-xs text-muted mt-1">
                  {r._count.matches} matches · Recorded: {r.status}
                </p>
              </>
            ),
          },
          { label: "Created", render: (r) => date(r.createdAt) },
          {label:"Tracking",render:r=>r.requesterRole==="BUYER"?<a className="text-primary whitespace-nowrap" href={`/admin/rfq-tracking/${r.id}`} onClick={event=>{if(onTrackRfq&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onTrackRfq(r.id);}}}>Track RFQ</a>:<span className="text-xs text-muted">Manage supplier RFQ in detail</span>},
        ]}
      />
      <Pagination list={list} />
    </div>
  );
}
