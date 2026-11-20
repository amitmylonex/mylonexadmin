import React, { useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { apiRequest } from "../../../lib/api";
import { AdminTable, PageHeading, QueryToolbar, ListFeedback, Pagination, money, date } from "../../../components/tables/AdminTable";
import { Dialog } from "../../../components/ui/Dialog";
import { quoteMargins } from "../../../../../shared/quote-margins";

type Quote = {
  id: string; price: string; supplierOriginalPrice: string | null; leadTimeDays: number; moq: number | null;
  sampleAvailability: string | null; dispatchLocation: string | null; responseImageUrls: string[]; validUntilDate?: string | null;
  supplier: {companyName: string}; whatsAppTerms?: { priceValidUntil?: string; priceBasis?: string; remarks?: string };
  requestMatch: { communicationRequest: { rfqNumber: string; quantity: number; fabricName: string; targetPriceMin: number | null; targetPriceMax: number | null } };
};
const supplierBid = (quote: Quote) => Number(quote.supplierOriginalPrice ?? quote.price);
const safeImages = (urls: string[]) => urls.filter(url => {try {return new URL(url).protocol === "https:";} catch {return false;}}).slice(0, 12);
const istDate = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0,10);
export function QuoteApprovalsPage() {
  const list = useAdminList<Quote>("/api/v1/admin/quote-approvals", "quotes");
  const [target, setTarget] = useState<Quote | null>(null), [price, setPrice] = useState(""), [expiry, setExpiry] = useState("");
  const [note, setNote] = useState(""), [reason, setReason] = useState(""), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  function review(quote: Quote) {
    setTarget(quote); setPrice(String(quote.price)); setExpiry(quote.validUntilDate ? new Date(new Date(quote.validUntilDate).getTime() + 5.5 * 3600000).toISOString().slice(0,10) : "");
    setNote(""); setReason(""); setError("");
  }
  const finalPrice = price.trim() ? Number(price) : target ? Number(target.price) : 0;
  const margins = target ? quoteMargins(supplierBid(target), finalPrice, target.requestMatch.communicationRequest.quantity) : null;
  const priceValid = margins && finalPrice <= 9999999999.99 && /^\d+(?:\.\d{1,2})?$/.test(price.trim());
  async function decide(decision: "approve" | "reject") {
    if (!target) return;
    setBusy(true); setError("");
    try {
      const payload = decision === "approve" ? { markupPriceInr: finalPrice, adminReviewNote: note, ...(expiry ? { validUntilDate: expiry } : {}) } : { rejectionReason: reason.trim() };
      const result = await apiRequest<any>(`/api/v1/admin/quote-approvals/${target.id}/${decision}`, {method:"POST",body:JSON.stringify(payload)});
      setMessage(`Quote ${decision === "approve" ? "released to buyer" : "rejected"}. ${result.notification?.message || ""}`);
      setTarget(null); list.reload();
    } catch (failure: any) { setError(failure.message); }
    finally {setBusy(false);}
  }
  return <div className="space-y-6">
    <PageHeading title="Quote Approval Queue" description="Review supplier bids, set the buyer price and release approved quotes." />
    <QueryToolbar list={list} /><ListFeedback list={list} />
    {message && <p role="status" className="card p-4 text-sm">{message}</p>}
    <AdminTable items={list.items} empty="No quotes awaiting review." columns={[
      {label:"RFQ Number",render:q => <><strong>{q.requestMatch.communicationRequest.rfqNumber}</strong><p className="text-xs text-muted">{q.requestMatch.communicationRequest.fabricName}</p></>},
      {label:"Supplier Company",render:q => q.supplier.companyName},
      {label:"Supplier Price (INR/m)",render:q => money(supplierBid(q))},
      {label:"Admin Marked-up Price",render:q => q.supplierOriginalPrice == null ? "Not set" : money(q.price)},
      {label:"Lead Time",render:q => `${q.leadTimeDays} days`},
      {label:"MOQ",render:q => q.moq == null ? "Not supplied" : `${q.moq.toLocaleString("en-IN")} m`},
      {label:"Sample Availability",render:q => q.sampleAvailability || "Not supplied"},
      {label:"Actions",render:q => <button className="btn-outline text-xs whitespace-nowrap" onClick={() => review(q)}>Review Quote</button>},
    ]} />
    <Pagination list={list} />
    <Dialog open={!!target} title="Review Quote" busy={busy} onClose={() => setTarget(null)}>
      {target && <div className="space-y-5">
        <p className="text-sm font-semibold">{target.supplier.companyName} · {target.requestMatch.communicationRequest.rfqNumber}</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <dl className="grid grid-cols-2 gap-4 text-sm rounded-xl bg-slate-50 p-4">
          <div><dt className="text-muted">Supplier bid / m</dt><dd>{money(supplierBid(target))}</dd></div>
          <div><dt className="text-muted">Buyer target / m</dt><dd>{money(target.requestMatch.communicationRequest.targetPriceMin)} – {money(target.requestMatch.communicationRequest.targetPriceMax)}</dd></div>
          <div><dt className="text-muted">Dispatch location</dt><dd>{target.dispatchLocation || "Not supplied"}</dd></div>
          <div><dt className="text-muted">Sample availability</dt><dd>{target.sampleAvailability || "Not supplied"}</dd></div>
        </dl>
        {target.whatsAppTerms && <section className="text-xs rounded-xl border border-border p-4 space-y-2"><h3 className="font-semibold">Supplier WhatsApp terms</h3><p>Price basis: {target.whatsAppTerms.priceBasis || "Not supplied"}</p><p>Supplier validity: {date(target.whatsAppTerms.priceValidUntil)}</p><p>{target.whatsAppTerms.remarks}</p><p className="text-muted">Supplier terms remain unchanged. Confirm expired supplier terms before release.</p></section>}
        {!!safeImages(target.responseImageUrls || []).length && <section aria-label="Fabric images" className="grid grid-cols-3 gap-3">{safeImages(target.responseImageUrls).map((url,index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Supplier fabric ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" className="w-full h-28 rounded-lg object-cover" /></a>)}</section>}
        <form className="space-y-4" onSubmit={event => {event.preventDefault(); if(priceValid) decide("approve");}}>
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm">Final buyer price (INR/m)<input className="input mt-1" type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" required value={price} onChange={event => setPrice(event.target.value)} /></label>
            <section aria-label="Commercial calculator" className="rounded-xl bg-blue-50 p-4 text-sm space-y-1">
              <p>Gross profit / m: <strong>{margins ? money(margins.profitPerMeter) : "—"}</strong></p>
              <p>Platform margin: <strong>{margins ? `${margins.marginPercent.toFixed(2)}%` : "—"}</strong> (profit ÷ final buyer price)</p>
              <p>Markup: <strong>{margins ? `${margins.markupPercent.toFixed(2)}%` : "—"}</strong> (profit ÷ supplier price)</p>
              <p>Estimated gross profit: {margins ? money(margins.estimatedGrossProfit) : "—"}</p>
              <p className="text-xs text-muted">Before tax, delivery and operating costs.</p>
              {margins && margins.profitPerMeter < 0 && <p className="text-red-700">The final buyer price is below the supplier bid.</p>}
            </section>
            <label className="block text-sm">Quote expiry (inclusive, IST)<input className="input mt-1" type="date" min={istDate()} value={expiry} onChange={event => setExpiry(event.target.value)} /></label>
            <label className="block text-sm">Admin internal notes<textarea className="input mt-1" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
            <button className="btn-primary w-full" disabled={!priceValid || busy}>Release Quote to Buyer</button>
          </fieldset>
        </form>
        <form className="border-t border-border pt-4 space-y-3" onSubmit={event => {event.preventDefault(); if(reason.trim()) decide("reject");}}>
          <label className="block text-sm">Rejection reason<textarea className="input mt-1" required maxLength={2000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
          <button className="btn-outline w-full" disabled={busy || !reason.trim()}>Reject Quote to Supplier</button>
        </form>
      </div>}
    </Dialog>
  </div>;
}
