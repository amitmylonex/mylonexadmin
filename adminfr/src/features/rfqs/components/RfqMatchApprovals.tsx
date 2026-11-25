import { useEffect, useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { apiRequest } from "../../../lib/api";
import { QueryToolbar, ListFeedback, Pagination } from "../../../components/tables/AdminTable";

type Match = {
  id: string; sourceType: string; score: number; createdAt: string;
  supplier: { companyName: string; status: string; user: { email: string } };
  communicationRequest: { id: string; rfqNumber: string; fabricName: string; quantity: number; deliveryPincode: string; requesterRole: string; buyer: { fullName: string | null; email: string } };
};
function relativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "—";
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return days < 1 ? formatter.format(0, "day") : days < 30 ? formatter.format(-days, "day") : formatter.format(-Math.floor(days / 30), "month");
}
export function RfqMatchApprovals({ onSelectRfq, onReviewRfqs }: { onSelectRfq?: (id: string) => void; onReviewRfqs?: () => void }) {
  const list = useAdminList<Match>("/api/v1/admin/rfq-match-approvals", "matches");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkNote, setBulkNote] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { setSelected([]); }, [list.items, list.page, list.search, list.sort]);
  async function decide(decision: "forward" | "reject", ids: string[], bulk = false) {
    if (!ids.length || busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await apiRequest<{changedCount: number; requestedCount: number; notification?: {message: string}}>(
        bulk ? "/api/v1/admin/rfq-match-approvals/bulk" : `/api/v1/admin/rfq-match-approvals/${ids[0]}/${decision}`,
        { method: "POST", body: JSON.stringify(bulk ? { ids, decision, note: bulkNote } : { note: notes[ids[0]] || "" }) });
      setMessage(`${result.changedCount} of ${result.requestedCount} supplier matches ${decision === "forward" ? "forwarded" : "rejected"}. ${result.changedCount < result.requestedCount ? "Some matches changed or are no longer eligible. Refresh and review the remaining rows. " : ""}${result.notification?.message || ""}`);
      setSelected([]); list.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the decision."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 min-w-0">
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <div className="rounded-lg border border-ink/10 bg-ink/5 p-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="block text-xs text-ink/60">Bulk Review Note (Optional)<input className="input mt-1" value={bulkNote} onChange={e => setBulkNote(e.target.value)} maxLength={2000} placeholder="Optional note for all selected decisions" /></label>
        <button className="btn-primary" disabled={!selected.length || list.loading || !!list.error} onClick={() => decide("forward", selected, true)}>Forward Selected ({selected.length})</button>
        <button className="btn-ghost" disabled={!selected.length || list.loading || !!list.error} onClick={() => decide("reject", selected, true)}>Reject Selected ({selected.length})</button>
      </div>
      <details className="text-xs text-muted"><summary className="cursor-pointer">Search and sort</summary><div className="mt-3"><QueryToolbar list={list} /></div></details>
      <ListFeedback list={list} />
      <div className="overflow-x-auto rounded-lg border border-ink/10 bg-surface/90">
        <table className="min-w-full divide-y divide-ink/10 text-sm rfq-approval-table">
          <thead className="bg-ink/5 text-left text-ink/60"><tr>
            <th className="px-4 py-3"><input type="checkbox" aria-label="Select all RFQ matches" checked={!!list.items.length && selected.length === list.items.length} disabled={list.loading || !!list.error} onChange={e => setSelected(e.target.checked ? list.items.map(row => row.id) : [])} /></th>
            {["RFQ", "Requester", "Requirement", "Matched Supplier", "Source", "Score", "Created", "Decision"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink/10">{list.items.map(row => {
            const rfq = row.communicationRequest;
            return <tr key={row.id}>
              <td><input type="checkbox" aria-label={`Select ${rfq.rfqNumber} for ${row.supplier.companyName}`} checked={selected.includes(row.id)} onChange={e => setSelected(previous => e.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id))} /></td>
              <td><button className="text-left font-medium text-ink break-words" onClick={() => onSelectRfq?.(rfq.id)}>{rfq.rfqNumber}</button><p className="text-xs text-muted mt-1">{rfq.requesterRole}</p></td>
              <td>{rfq.buyer.fullName || "Name not supplied"}<p className="text-xs">{rfq.buyer.email}</p></td>
              <td>{rfq.fabricName}<p className="text-xs">Qty: {rfq.quantity.toLocaleString("en-IN")}m, PIN: {rfq.deliveryPincode}</p></td>
              <td>{row.supplier.companyName}<p className="text-xs">{row.supplier.user.email}</p></td>
              <td>{row.sourceType}</td><td>{Math.round(row.score)}</td><td title={new Date(row.createdAt).toLocaleString("en-IN")}>{relativeDate(row.createdAt)}</td>
              <td><div className="space-y-2 min-w-[210px]">
                <input className="input" aria-label={`Review note for ${rfq.rfqNumber} and ${row.supplier.companyName}`} placeholder="Optional review note" maxLength={2000} value={notes[row.id] || ""} onChange={e => setNotes(previous => ({...previous, [row.id]: e.target.value}))} />
                <button className="btn-primary w-full" disabled={row.supplier.status !== "APPROVED"} onClick={() => decide("forward", [row.id])}>Forward to Supplier</button>
                <button className="btn-ghost w-full" onClick={() => decide("reject", [row.id])}>Reject</button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
        {!list.loading && !list.error && !list.items.length && <div className="p-10 text-center space-y-3">
          <p className="text-muted">No RFQ matches pending admin forward.</p>
          <p className="text-sm text-muted">RFQs without supplier matches are still available in Buyer RFQ review.</p>
          {onReviewRfqs && <button className="btn-outline" onClick={onReviewRfqs}>Review pending RFQs</button>}
        </div>}
      </div>
      <Pagination list={list} />
    </fieldset>
    {message && <p role="status" className="rounded-lg border border-border p-4 text-sm">{message}</p>}
  </div>;
}
