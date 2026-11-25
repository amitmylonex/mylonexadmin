import {useState} from "react";
import {useApprovedSuppliers} from "../../../hooks/useApprovedSuppliers";
import {rfqApi} from "../api/rfq-api";
import {useRfqActions} from "../hooks/useRfqActions";
import type {RfqDetail} from "../types";
export function RfqSourcingActions({rfq,onSaved,onSelectSupplier}:{rfq:RfqDetail;onSaved:()=>void;onSelectSupplier?:(id:string)=>void}) {
  const [search,setSearch]=useState(""),[supplierId,setSupplierId]=useState(""),[note,setNote]=useState("");
  const lookup=useApprovedSuppliers(search,true,true),action=useRfqActions(onSaved);
  const suppliers=lookup.suppliers.filter(s=>!rfq.matches.some(m=>m.supplierId===s.id));
  const closed=!["pending","approved","active","open","in_progress","quoted"].includes(rfq.status);
  const valid=suppliers.some(s=>s.id===supplierId)&&!!note.trim()&&!lookup.loading&&!lookup.searching&&!closed;
  return <div className="space-y-5">
    {(rfq._count?.matches??rfq.matches.length)===0&&<section className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center"><h2 className="text-lg font-semibold">No Matches Found</h2><p className="mt-2 text-sm">No supplier matches have been saved. Add an approved supplier manually or re-run matching against current active listings. Approval can be completed while supplier sourcing continues.</p></section>}
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-white p-5 space-y-3"><h2 className="text-lg font-semibold">Add supplier manually</h2><p className="text-sm text-muted">The match enters Admin review. Suppliers are notified only after forwarding.</p>
        <form onSubmit={event=>{event.preventDefault();if(valid)void action.run(async()=>{const result=await rfqApi.manual(rfq.id,supplierId,note.trim());setSupplierId("");setNote("");return result.notification?.message||"Manual match staged for review.";});}}>
          <fieldset disabled={action.busy||closed} className="space-y-3">
            <label className="block text-xs">Find approved supplier<input className="input mt-1" maxLength={150} value={search} onChange={e=>{setSearch(e.target.value);setSupplierId("");}}/></label>
            <label className="block text-xs">Supplier<select className="input mt-1" value={supplierId} required disabled={lookup.loading||lookup.searching||!suppliers.length} onChange={e=>setSupplierId(e.target.value)}><option value="">{lookup.loading||lookup.searching?"Loading suppliers…":suppliers.length?"Select supplier":"No approved suppliers available"}</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.companyName}</option>)}{!!lookup.pendingSuppliers.length&&<optgroup label="Awaiting approval (not eligible)">{lookup.pendingSuppliers.map(s=><option key={s.id} disabled>{s.companyName} — Pending approval</option>)}</optgroup>}</select></label>
            <label className="block text-xs">Matching reason<input className="input mt-1" required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
            <button className="btn-primary w-full" disabled={!valid}>Add match for review</button>
          </fieldset>
        </form>
        {lookup.error&&<p role="alert" className="text-sm text-red-700">Could not load suppliers: {lookup.error.message}</p>}
        {!lookup.loading&&!lookup.searching&&!lookup.error&&!suppliers.length&&<div className="text-sm text-amber-800 space-y-2"><p>{search?"No approved suppliers match this search.":"No approved suppliers are available for a new match."} {lookup.pendingCount>0?`${lookup.pendingCount} supplier(s) awaiting approval.`:"Suppliers already matched are omitted."}</p>{lookup.pendingSuppliers.map(s=><p key={s.id}>{s.companyName} — Pending approval. <a href={`/admin/suppliers/${s.id}`} className="underline" onClick={event=>{if(onSelectSupplier&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onSelectSupplier(s.id);}}}>Review supplier approval</a></p>)}</div>}
        {(lookup.loading||lookup.searching)&&<p role="status" className="text-xs text-muted">Loading approved suppliers…</p>}
        <button className="text-sm underline text-primary" disabled={lookup.loading||lookup.searching} onClick={lookup.reload}>Refresh suppliers</button>
      </section>
      <section className="rounded-xl border border-border bg-white p-5 space-y-3"><h2 className="text-lg font-semibold">Re-Run Matching</h2><p className="text-sm text-muted">Find eligible suppliers from current active catalog listings. Existing matches and decisions are preserved. New matches enter Admin review; this action sends no notifications.</p><button className="btn-primary w-full" disabled={action.busy||closed} onClick={()=>void action.run(async()=>{const result=await rfqApi.rematch(rfq.id);return result.message;})}>{action.busy?"Working…":"Re-Run Matching Engine"}</button>{closed&&<p className="text-sm text-muted">Sourcing is closed for this RFQ.</p>}</section>
    </div>
    {action.error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{action.error}</p>}
    {action.message&&<p role="status" className="rounded-lg bg-green-50 p-4 text-sm">{action.message}</p>}
  </div>;
}
