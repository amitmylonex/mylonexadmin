import React, { useEffect, useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { PageHeading, QueryToolbar, ListFeedback, Pagination, money, date } from "../../../components/tables/AdminTable";
import { Dialog } from "../../../components/ui/Dialog";
import { apiRequest } from "../../../lib/api";
type Rfq = { id: string; rfqNumber: string; fabricName: string; quantity: number; targetPriceMin: number | null; targetPriceMax: number | null;
  deliveryPincode: string; requiredDeliveryDate?: string; priority: string; buyerReference: string; buyerAnonymized: boolean; buyerRemarks?: string;
  specPayload: { composition?: string; fabricStructure?: string; data: Record<string, unknown> };
  proposedMatches: Array<{supplierId: string; companyName: string; score: number; explanation: string; whatsappConsent: boolean}> };
export function RfqApprovalsPage({ onSelectRfq }: { onSelectRfq?: (id: string) => void }) {
  const list = useAdminList<Rfq>("/api/v1/admin/rfq-approvals", "rfqs", { pageSize: "10" });
  const [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [rejectIds, setRejectIds] = useState<string[]>([]), [reason, setReason] = useState(""), [spec, setSpec] = useState<Rfq | null>(null);
  const [failures, setFailures] = useState<Array<{rfqId: string; message: string}>>([]);
  useEffect(() => { setSelected([]); }, [list.items, list.page, list.search, list.sort]);
  async function decide(decision: "approve" | "reject", ids: string[]) {
    setBusy(true); setMessage(""); setFailures([]);
    try {
      const result = await apiRequest<any>(ids.length === 1 ? `/api/v1/admin/rfq-approvals/${ids[0]}/${decision}` : "/api/v1/admin/rfq-approvals/bulk", {
        method: "POST", body: JSON.stringify(ids.length === 1 ? (decision === "reject" ? {reason} : {}) : {ids, decision, ...(decision === "reject" ? {reason} : {})}),
      });
      setMessage(`${result.alreadyReviewed ? "RFQ already reviewed." : `${result.changedCount ?? 1} RFQ(s) reviewed.`} ${result.matchedSupplierCount ?? 0} supplier routes saved; ${result.queuedCount ?? 0} WhatsApp notifications queued. Queueing is not delivery confirmation.`);
      setFailures(result.failures || []); setSelected([]); setRejectIds([]); setReason(""); list.reload();
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const openReject = (ids: string[]) => { setMessage(""); setReason(""); setRejectIds(ids); };
  return <div className="space-y-6">
    <PageHeading title="RFQ Approval Queue" description="Review buyer production requests and route them to approved suppliers." />
    <div className="grid sm:grid-cols-2 gap-4" aria-label="Queue metrics">
      <div className="card p-5"><p className="text-sm text-muted">Pending review</p><strong className="text-3xl">{list.data?.metrics?.pendingCount ?? "—"}</strong></div>
      <div className="card p-5"><p className="text-sm text-muted">Urgent priority</p><strong className="text-3xl text-amber-700">{list.data?.metrics?.urgentCount ?? "—"}</strong></div>
    </div>
    <p className="text-sm text-muted">Approval saves dashboard routes and queues eligible WhatsApp notifications. Delivery requires the configured notification worker; non-consented suppliers receive dashboard routing only.</p>
    <fieldset disabled={busy} className="space-y-4">
      <QueryToolbar list={list} /><ListFeedback list={list} />
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <label className="text-sm"><input type="checkbox" aria-label="Select all on this page" checked={Boolean(list.items.length) && selected.length === list.items.length} disabled={list.loading || !!list.error} onChange={e => setSelected(e.target.checked ? list.items.map(r => r.id) : [])} /> Select page</label>
        <button className="btn-primary" disabled={!selected.length || list.loading || !!list.error} onClick={() => decide("approve", selected)}>Approve Selected ({selected.length})</button>
        <button className="btn-outline" disabled={!selected.length || list.loading || !!list.error} onClick={() => openReject(selected)}>Reject Selected</button>
      </div>
      {!list.loading && !list.error && !list.items.length && <p className="card p-10 text-center text-muted">No pending RFQs found.</p>}
      {!list.loading && !list.error && list.items.map(r => <article key={r.id} className="card p-5 space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3"><input type="checkbox" aria-label={`Select ${r.rfqNumber}`} checked={selected.includes(r.id)} onChange={e => setSelected(v => e.target.checked ? [...v, r.id] : v.filter(id => id !== r.id))} />
            <div><button className="text-primary font-semibold" onClick={() => onSelectRfq?.(r.id)}>{r.rfqNumber}</button><h2 className="text-lg font-semibold">{r.fabricName || "Fabric request"}</h2></div></div>
          {["urgent", "high"].includes(r.priority) && <span className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">Urgent priority</span>}
        </header>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-muted">Quantity</dt><dd>{r.quantity.toLocaleString("en-IN")} m</dd></div>
          <div><dt className="text-muted">Target price / m</dt><dd>{money(r.targetPriceMin)} – {money(r.targetPriceMax)}</dd></div>
          <div><dt className="text-muted">Delivery</dt><dd>{r.deliveryPincode || "Not supplied"}<p>{date(r.requiredDeliveryDate)}</p></dd></div>
          <div><dt className="text-muted">Buyer reference</dt><dd>{r.buyerReference}<p className="text-xs text-muted">{r.buyerAnonymized ? "Identity anonymized" : "Identity disclosed"}</p></dd></div>
        </dl>
        <button className="btn-outline text-sm" onClick={() => setSpec(r)}>Inspect detailed specs</button>
        <section aria-label={`Matched suppliers for ${r.rfqNumber}`} className="rounded-xl bg-slate-50 p-4 space-y-3">
          <h3 className="font-semibold text-sm">Matched suppliers preview ({r.proposedMatches.length})</h3>
          {r.proposedMatches.map(s => <div key={s.supplierId} className="text-sm"><strong>{s.companyName}</strong> · Score {s.score.toFixed(0)}<p className="text-muted text-xs">{s.explanation}</p><p className="text-xs">{s.whatsappConsent ? "WhatsApp consent recorded" : "Dashboard routing only"}</p></div>)}
          {!r.proposedMatches.length && <p className="text-sm text-amber-800">No eligible supplier matches. Inspect the requirements or open the RFQ to add an approved manual match.</p>}
        </section>
        <div className="flex gap-3"><button className="btn-primary" disabled={!r.proposedMatches.length} onClick={() => decide("approve", [r.id])}>Approve &amp; Route</button><button className="btn-outline" onClick={() => openReject([r.id])}>Reject</button></div>
      </article>)}
      <Pagination list={list} />
    </fieldset>
    {message && <p role="status" className="card p-4 text-sm">{message}</p>}
    {!!failures.length && <div role="alert" className="card p-4"><h2 className="font-semibold">RFQs requiring attention</h2>{failures.map(f => <p key={f.rfqId} className="text-sm">{f.rfqId}: {f.message}</p>)}</div>}
    <Dialog open={!!rejectIds.length} title={`Reject ${rejectIds.length} RFQ(s)`} busy={busy} onClose={() => setRejectIds([])}>
      {message && <p role="status" className="mb-4 text-sm">{message}</p>}
      <form onSubmit={e => {e.preventDefault(); if (reason.trim()) decide("reject", rejectIds);}} className="space-y-4">
        <label className="block text-sm">Rejection reason<textarea className="input mt-2" required maxLength={2000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="btn-primary" disabled={busy || !reason.trim()}>Confirm rejection</button>
      </form>
    </Dialog>
    <Dialog open={!!spec} title={`${spec?.rfqNumber || "RFQ"} specifications`} onClose={() => setSpec(null)}>
      {spec && <div className="space-y-4 text-sm"><p><strong>Blend:</strong> {spec.specPayload?.composition || "Not supplied"}</p><p><strong>Structure:</strong> {spec.specPayload?.fabricStructure || "Not supplied"}</p>
        <dl className="space-y-3">{Object.entries(spec.specPayload?.data || {}).map(([key, value]) => <div key={key}><dt className="font-semibold">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="whitespace-pre-wrap break-words">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl><p><strong>Buyer remarks:</strong> {spec.buyerRemarks || "None supplied"}</p></div>}
    </Dialog>
  </div>;
}
