import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { Dialog } from "./ui/Dialog";
import { maskSupplierPhone } from "../features/suppliers/supplier-phone";

interface Props {
  supplierId: string; companyName: string; phone: string | null; phoneCountryCode: string | null;
  whatsappConsent: boolean; whatsappConsentAt: string | null; onConsentUpdated: () => void;
}
export function SupplierWhatsAppConsentCard(props: Props) {
  const [editing, setEditing] = useState(false), [phone, setPhone] = useState(props.phone || "");
  const [confirmed, setConfirmed] = useState(false), [revoking, setRevoking] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => { setPhone(props.phone || ""); setConfirmed(false); setEditing(false); setError(""); }, [props.supplierId, props.phone]);
  const save = async (consent: boolean) => {
    if (busy) return;
    if (consent && !confirmed) { setError("Explicit supplier confirmation is required."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest(`/api/v1/admin/suppliers/${props.supplierId}/whatsapp-consent`, {
        method: "POST", body: JSON.stringify({ consent, explicitConfirmation: consent && confirmed, ...(consent ? { phone: editing ? phone : props.phone || undefined } : {}) }),
      });
      setEditing(false); setConfirmed(false); setRevoking(false);
      setMessage(consent ? "WhatsApp consent recorded." : "WhatsApp consent revoked.");
      props.onConsentUpdated();
    } catch (failure: any) { setError(failure.message || "Could not update WhatsApp consent"); }
    finally { setBusy(false); }
  };
  return <section className="card p-6 space-y-5" aria-label="Supplier WhatsApp consent">
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">WhatsApp RFQ Notifications</h2><p className="text-sm text-muted">Manage the supplier's permission to receive RFQ notifications.</p></div>
      <span className={`self-start rounded-full border px-3 py-1 text-xs ${props.whatsappConsent ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-50 text-slate-600"}`}>{props.whatsappConsent ? "Consented" : "Not recorded"}</span></header>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><p className="label">Registered WhatsApp number</p>
      {editing ? <><label className="block text-sm">WhatsApp phone<input type="tel" className="input block mt-1 w-full" maxLength={25} value={phone} disabled={busy} onChange={event => { setPhone(event.target.value); setConfirmed(false); }} /></label>
        <button className="btn-ghost text-xs" disabled={busy} onClick={() => { setEditing(false); setPhone(props.phone || ""); setConfirmed(false); }}>Cancel phone edit</button></>
        : <div className="flex items-center gap-4"><span className="font-mono text-sm">{maskSupplierPhone(props.phone, props.phoneCountryCode)}</span><button className="btn-ghost text-xs" disabled={busy} onClick={() => { setPhone(props.phone || ""); setEditing(true); setConfirmed(false); }}>{props.phone ? "Edit phone" : "Add phone"}</button></div>}
      <p className="text-xs text-muted">Default country code: +{props.phoneCountryCode || "91"}.</p></div>
      <div><p className="label">Consent recorded</p><p className="mt-2 text-sm">{props.whatsappConsentAt ? new Date(props.whatsappConsentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "No consent record on file"}</p></div></div>
    {(!props.whatsappConsent || editing) && <div className="space-y-4 border-t border-border pt-4">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
        <span>Explicit Consent Confirmation: I confirm that {props.companyName} explicitly agreed to receive RFQ notifications via WhatsApp at this number.</span></label>
      <button className="btn-primary text-sm" disabled={busy || !confirmed || !(editing ? phone.trim() : props.phone)} onClick={() => save(true)}>{busy ? "Saving…" : "Record WhatsApp Consent"}</button>
    </div>}
    {props.whatsappConsent && <div className="border-t border-border pt-4"><button className="btn-outline text-sm text-rose-700" disabled={busy} onClick={() => setRevoking(true)}>Revoke WhatsApp Consent</button></div>}
    <Dialog open={revoking} title="Revoke WhatsApp consent?" onClose={() => setRevoking(false)} busy={busy}>
      <p className="text-sm mb-5">{props.companyName} will stop receiving WhatsApp RFQ notifications. Existing orders are preserved.</p>
      <div className="flex justify-end gap-3"><button className="btn-outline" disabled={busy} onClick={() => setRevoking(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={() => save(false)}>{busy ? "Revoking…" : "Revoke Consent"}</button></div>
    </Dialog>
  </section>;
}
