import React,{useState} from "react";
import {Dialog} from "../../../components/ui/Dialog";
import {useAdminList} from "../../../hooks/useAdminList";
import {Pagination, ListFeedback, date} from "../../../components/tables/AdminTable";
import type {DispatchLog} from "../../../../../shared/rfq-tracking";
export function DispatchLogs({matchId}:{matchId:string}) {
  const [open,setOpen]=useState(false);
  const list=useAdminList<DispatchLog>(`/api/v1/admin/rfq-tracking/${matchId}/dispatch-logs`,"logs",{pageSize:"10"},{enabled:open});
  return <><button className="btn-outline text-xs" onClick={()=>{setOpen(true);list.reload();}}>View dispatch logs</button><Dialog open={open} title="WhatsApp dispatch logs" onClose={()=>setOpen(false)}>
    <p className="text-xs text-muted mb-4">Each message has independent delivery and read receipts. Legacy snapshots contain only retained evidence.</p>
    <ListFeedback list={list}/>{!list.loading&&!list.items.length&&!list.error&&<p>No dispatch attempts recorded.</p>}
    <ol className="space-y-4 mb-5">{list.items.map(log=><li key={log.id} className="rounded-xl border border-border p-4 text-sm"><strong>{log.kind} · {log.status}</strong><p>{log.kind==="LEGACY_SNAPSHOT"?"Legacy snapshot recorded":"Queued / reserved"}: {date(log.requestedAt)}</p><p>Sent: {date(log.sentAt)}</p><p>Delivered: {date(log.deliveredAt)}</p><p>Read: {date(log.readAt)}</p>{log.failureCode&&<p>Error code: {log.failureCode}</p>}</li>)}</ol><Pagination list={list}/>
  </Dialog></>;
}
