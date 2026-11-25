import React, { useEffect, useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { QueryToolbar, ListFeedback, Pagination, money, date } from "../../../components/tables/AdminTable";
import { Dialog } from "../../../components/ui/Dialog";
import { apiRequest } from "../../../lib/api";
type Rfq = { id: string; rfqNumber: string; fabricName: string; quantity: number; targetPriceMin: number | null; targetPriceMax: number | null;
  deliveryPincode: string; requiredDeliveryDate?: string; priority: string; createdAt?: string; buyerReference: string; buyerAnonymized: boolean; buyerRemarks?: string;
  specPayload: { composition?: string; fabricStructure?: string; data: Record<string, unknown> };
  proposedMatches: Array<{supplierId: string; companyName: string; sourceType?: string; score: number; explanation: string; whatsappConsent: boolean}> };
export function PendingRfqApprovalsPage({ onSelectRfq }: { onSelectRfq?: (id: string) => void }) {
  const list = useAdminList<Rfq>("/api/v1/admin/rfq-approvals", "rfqs", { pageSize: "10" });
  const [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [rejectIds, setRejectIds] = useState<string[]>([]), [reason, setReason] = useState(""), [spec, setSpec] = useState<Rfq | null>(null);
  const [bulkNote, setBulkNote] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [failures, setFailures] = useState<Array<{rfqId: string; message: string}>>([]);
  useEffect(() => { setSelected([]); }, [list.items, list.page, list.search, list.sort]);
  async function decide(decision: "approve" | "reject", ids: string[]) {
    setBusy(true); setMessage(""); setFailures([]);
    try {
      const result = await apiRequest<any>(ids.length === 1 ? `/api/v1/admin/rfq-approvals/${ids[0]}/${decision}` : "/api/v1/admin/rfq-approvals/bulk", {
        method: "POST", body: JSON.stringify(ids.length === 1 ? (decision === "reject" ? {reason} : {note: notes[ids[0]] || bulkNote}) : {ids, decision, ...(decision === "reject" ? {reason} : {note: bulkNote})}),
      });
      const awaiting = result.awaitingSupplierCount ?? (result.routingPending ? 1 : 0);
      setMessage(`${result.alreadyReviewed ? "RFQ already reviewed." : `${result.changedCount ?? 1} RFQ(s) reviewed.`} ${awaiting ? `${awaiting} RFQ(s) approved awaiting supplier sourcing. Open All RFQs to add suppliers later. ` : ""}${result.matchedSupplierCount ?? 0} supplier routes saved; ${result.queuedCount ?? 0} WhatsApp notifications queued. Queueing is not delivery confirmation.`);
      setFailures(result.failures || []); setSelected([]); setRejectIds([]); setReason(""); list.reload();
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const openReject = (ids: string[]) => { setMessage(""); setReason(ids.length === 1 ? notes[ids[0]] || bulkNote : bulkNote); setRejectIds(ids); };
  return <div className="space-y-6">
    <fieldset disabled={busy} className="space-y-4 min-w-0">
      <div className="rounded-lg border border-ink/10 bg-ink/5 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]"><label className="block text-xs text-muted">Bulk Review Note (Optional)<input className="input mt-1" maxLength={2000} placeholder="Optional note for all selected decisions" value={bulkNote} onChange={e => setBulkNote(e.target.value)} /></label><div className="mt-2 flex gap-4 text-xs text-muted" aria-label="Queue metrics">
          <p>Pending review<strong className="ml-1 text-ink">{list.data?.metrics?.pendingCount ?? "—"}</strong></p>
          <p className="mt-1">Urgent priority <strong className="text-amber-700">{list.data?.metrics?.urgentCount ?? "—"}</strong></p>
        </div></div>
        <button className="btn-primary" disabled={!selected.length || list.loading || !!list.error} onClick={() => decide("approve", selected)}>Approve Selected ({selected.length})</button>
        <button className="btn-ghost" disabled={!selected.length || list.loading || !!list.error} onClick={() => openReject(selected)}>Reject Selected ({selected.length})</button>
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Search, sort and routing information</summary>
        <div className="mt-3 space-y-3"><QueryToolbar list={list} /><p>RFQs can be approved without supplier matches and sourced later. When matches exist, approval also saves dashboard routes and queues eligible WhatsApp notifications. Delivery requires the configured notification worker; non-consented suppliers receive dashboard routing only.</p></div>
      </details>
      <ListFeedback list={list} />
      <div className="overflow-x-auto rounded-lg border border-ink/10 bg-surface/90">
        <table className="min-w-full divide-y divide-ink/10 text-sm rfq-approval-table">
          <thead className="bg-ink/5 text-left text-ink/60"><tr>
            <th className="px-4 py-3"><input type="checkbox" aria-label="Select all on this page" checked={Boolean(list.items.length) && selected.length === list.items.length} disabled={list.loading || !!list.error} onChange={e => setSelected(e.target.checked ? list.items.map(r => r.id) : [])} /></th>
            {["RFQ", "Requester", "Requirement", "Matched Supplier", "Source", "Score", "Created", "Decision"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink/10">
            {!list.loading && !list.error && list.items.map(r => <tr key={r.id}>
              <td><input type="checkbox" aria-label={`Select ${r.rfqNumber}`} checked={selected.includes(r.id)} onChange={e => setSelected(v => e.target.checked ? [...v, r.id] : v.filter(id => id !== r.id))} /></td>
              <td><button className="text-left text-ink font-medium break-words" onClick={() => onSelectRfq?.(r.id)}>{r.rfqNumber}</button><p className="text-xs text-muted mt-1">BUYER</p>{["urgent", "high"].includes(r.priority) && <p className="text-xs text-amber-700 mt-1">Urgent priority</p>}</td>
              <td><p>{r.buyerReference}</p><p className="text-xs text-muted mt-1">{r.buyerAnonymized ? "Identity anonymized" : "Identity disclosed"}</p></td>
              <td><p>{r.fabricName || "Fabric request"}</p><p className="text-xs mt-1">Qty: {r.quantity.toLocaleString("en-IN")}m, PIN: {r.deliveryPincode || "Not supplied"}</p><p className="text-xs mt-1">Target: {money(r.targetPriceMin)} — {money(r.targetPriceMax)}</p><p className="text-xs mt-1">Delivery: {date(r.requiredDeliveryDate)}</p><button className="mt-2 text-primary text-xs underline" onClick={() => setSpec(r)}>Inspect detailed specs</button></td>
              <td><section aria-label={`Matched suppliers for ${r.rfqNumber}`} className="space-y-3">{r.proposedMatches.map(s => <div key={s.supplierId}><p>{s.companyName}</p><p className="text-xs mt-1 text-muted">{s.whatsappConsent ? "WhatsApp consent recorded" : "Dashboard routing only"}</p><p className="text-xs mt-1 text-muted">{s.explanation}</p></div>)}{!r.proposedMatches.length && <div className="space-y-2"><p className="text-xs text-amber-800">No eligible supplier matches. Inspect the requirements or open the RFQ to add an approved manual match.</p>{onSelectRfq && <button className="btn-outline text-xs" onClick={() => onSelectRfq(r.id)}>Review RFQ &amp; add supplier</button>}</div>}</section></td>
              <td>{r.proposedMatches.length ? r.proposedMatches.map(s => <p key={s.supplierId}>{s.sourceType || "—"}</p>) : "—"}</td>
              <td>{r.proposedMatches.length ? r.proposedMatches.map(s => <p key={s.supplierId}>{s.score.toFixed(0)}</p>) : "—"}</td>
              <td className="text-xs">{date(r.createdAt)}</td>
              <td><div className="space-y-2 min-w-[210px]"><input className="input" aria-label={`Review note for ${r.rfqNumber}`} maxLength={2000} placeholder="Optional review note" value={notes[r.id] || ""} onChange={e => setNotes(current => ({...current, [r.id]: e.target.value}))} /><button className="btn-primary w-full" onClick={() => decide("approve", [r.id])}>{r.proposedMatches.length ? "Approve & Route" : "Approve RFQ"}</button><button className="btn-ghost w-full" onClick={() => openReject([r.id])}>Reject</button><p className="text-xs text-muted">{r.proposedMatches.length ? "Routes to all matched suppliers." : "Approve now; add suppliers later. No notifications will be sent."}</p></div></td>
            </tr>)}
          </tbody>
        </table>
        {!list.loading && !list.error && !list.items.length && <p className="p-10 text-center text-muted">No pending RFQs found.</p>}
      </div>
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
