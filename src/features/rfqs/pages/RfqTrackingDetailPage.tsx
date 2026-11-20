import React,{useState} from "react";
import {apiRequest} from "../../../lib/api";
import {Dialog} from "../../../components/ui/Dialog";
import {ManualRouteForm} from "../components/ManualRouteForm";
import {DispatchLogs} from "../components/DispatchLogs";
import { useAdminList } from "../../../hooks/useAdminList";
import {
  PageHeading,
  ListFeedback,
  Pagination,
  Status,
  date,
  money,
} from "../../../components/tables/AdminTable";
import type { TrackingSupplier } from "../../../../../shared/rfq-tracking";
export function RfqTrackingDetailPage({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const list = useAdminList<TrackingSupplier>(
    `/api/v1/admin/rfq-tracking/${id}`,
    "suppliers",
  );
  const [resend,setResend]=useState<TrackingSupplier|null>(null),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function queueResend(event:React.FormEvent){event.preventDefault();if(!resend)return;setBusy(true);setMessage("");try{const result=await apiRequest<any>(`/api/v1/admin/rfq-tracking/${resend.id}/resend-whatsapp`,{method:"POST",body:JSON.stringify({reason})});setMessage(result.message);setResend(null);list.reload();}catch(error:any){setMessage(error.message);}finally{setBusy(false);}}
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-primary text-sm">
        ← Back to RFQ tracking
      </button>
      <PageHeading
        title={list.data?.inquiry.rfqNumber || "RFQ tracking detail"}
        description={list.data?.inquiry.fabricName}
      />
      <ListFeedback list={list} />
      {list.data?.lifecycle&&<ol aria-label="RFQ lifecycle" className="grid sm:grid-cols-3 xl:grid-cols-6 gap-3">{list.data.lifecycle.map((step:any)=><li key={step.key} className={`rounded-xl border p-4 text-sm ${step.recorded?"bg-green-50 border-green-200":"bg-white border-border"}`}><strong>{step.label}</strong><p className="text-xs mt-2">{step.recorded?(step.at?date(step.at):"Recorded; timestamp unavailable"):"Not recorded"}</p></li>)}</ol>}
      <p className="text-xs text-muted">Steps reflect independent recorded events. A later event does not fill missing earlier history. Supplier dashboard routing is distinct from WhatsApp delivery.</p>
      {list.data?.inquiry&&<ManualRouteForm id={id} status={list.data.lifecycle?.some((s:any)=>s.recorded&&["accepted","ordered"].includes(s.key))?"closed":list.data.inquiry.recordedStatus} onRouted={list.reload}/>}
      <button className="btn-outline" onClick={list.reload} disabled={list.loading}>Refresh tracking</button>
      {message&&!resend&&<p role="status" className="card p-4 text-sm">{message}</p>}
      {list.items.map((s) => (
        <section key={s.id} className="card p-6 space-y-5">
          <div className="flex justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold">{s.supplierName}</h2>
              <p className="text-xs text-muted">
                {s.sourceType} · {s.sourceId}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Status value={s.notificationStatus} />
              <span title={`Sent: ${date(s.sentAt)}; Delivered: ${date(s.deliveredAt)}; Read: ${date(s.readAt)}`}><Status value={s.deliveryStatus} /></span>
              <Status value={s.responseStatus} />
            </div>
          </div>
          <p className="text-xs text-muted">{s.eligibilityReason}</p>
          <p className="text-sm">Consent: {s.consentStatus} · Dispatch channel: {s.dispatchChannel}</p>
          {s.declineReason&&<p className="text-sm">Supplier decline reason: {s.declineReason}</p>}
          <p className="text-xs text-muted">Delivery pill describes the retained original message. Open dispatch logs for individual resends.</p>
          <div className="flex gap-3 flex-wrap"><DispatchLogs matchId={s.id}/><button className="btn-outline text-xs" disabled={!!s.resendBlockedReason} title={s.resendBlockedReason||"Queue a rate-limited WhatsApp resend"} onClick={()=>{setMessage("");setReason("");setResend(s);}}>Resend WhatsApp</button>{s.resendBlockedReason&&<p className="text-xs text-muted">{s.resendBlockedReason}</p>}</div>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              Sent {date(s.sentAt)}
              <p>Delivered {date(s.deliveredAt)}</p>
              <p>Read {date(s.readAt)}</p>
            </div>
            <div>
              Quote deadline {date(s.deadline)}
              <p>{s.deadlinePassed ? "Deadline passed" : ""}</p>
              <p>Reminders recorded: {s.reminderCount}</p>
            </div>
            <div>
              Match <Status value={s.matchStatus} />
              {s.failureCode && (
                <p className="text-red-700 text-xs mt-2">{s.failureCode}</p>
              )}
            </div>
          </div>
          {s.quote && (
            <div className="rounded-xl border border-border bg-slate-50 p-4 grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>{money(s.quote.price)}/m</strong>
                <p className="text-xs">
                  Original {money(s.quote.originalPrice)}
                </p>
                <p>{s.quote.priceBasis || "Price basis unavailable"}</p>
                <p>Validity {s.quote.priceValidity || "Unavailable"}</p>
                <p className={s.quote.priceExpired ? "text-amber-700" : ""}>
                  {s.quote.priceExpired ? "Expired · " : ""}
                  {date(s.quote.priceValidUntil)}
                </p>
              </div>
              <div>
                MOQ {s.quote.totalMoq || "—"}
                <p>MOQ per colour {s.quote.moqPerColour || "—"}</p>
                <p>Lead {s.quote.leadDays} days</p>
                <p>Sample {s.quote.sampleAvailability || "—"}</p>
                <p>Sample yardage {s.quote.sampleYardage || "—"}</p>
              </div>
              <div>
                <Status value={s.quote.approvalStatus} />
                <p className="mt-2 text-xs">{s.quote.remarks}</p>
                <p className="text-xs text-muted mt-2">
                  {s.quote.submittedAtLabel}: {date(s.quote.submittedAt)}
                </p>
              </div>
            </div>
          )}
          <details>
            <summary className="text-sm font-semibold cursor-pointer">
              Recorded timeline
            </summary>
            <ol className="mt-4 border-l border-border pl-5 space-y-4">
              {s.timeline.map((e) => (
                <li key={e.key} className="text-sm">
                  <p>{e.label}</p>
                  <time className="text-xs text-muted">{date(e.at)}</time>
                </li>
              ))}
            </ol>
            {s.unavailableEvents.length > 0 && (
              <p className="mt-4 text-xs text-muted">
                Unavailable evidence: {s.unavailableEvents.join("; ")}
              </p>
            )}
          </details>
        </section>
      ))}
      {!list.loading && !list.items.length && !list.error && (
        <p className="card p-6 text-sm text-muted">
          No matched suppliers found.
        </p>
      )}
      <Pagination list={list} />
      <Dialog open={!!resend} title="Resend WhatsApp notification" busy={busy} onClose={()=>setResend(null)}>
        <p className="text-sm mb-4">{resend?.supplierName}. At least 10 minutes between notifications; maximum three resends per match per day. The existing deadline stays unchanged.</p>
        {message&&<p role="alert" className="text-sm text-red-700 mb-4">{message}</p>}
        <form onSubmit={queueResend}><label className="block text-sm">Resend reason<textarea className="input mt-1" required disabled={busy} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="btn-primary mt-4" disabled={busy||!reason.trim()}>Queue resend</button></form>
      </Dialog>
    </div>
  );
}
