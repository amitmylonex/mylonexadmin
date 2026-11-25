import React, {useRef,useState} from "react";
import {useApprovedSuppliers} from "../../../hooks/useApprovedSuppliers";
import {apiRequest} from "../../../lib/api";
const successMessage="Supplier match staged for Admin review. No supplier notification has been sent.";
export function ManualRouteForm({id,status,matchedSupplierIds=[],onRouted}:{id:string;status:string;matchedSupplierIds?:string[];onRouted:()=>void}) {
  const [search,setSearch]=useState(""),[supplierId,setSupplierId]=useState("");
  const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false);
  const [stagedIds,setStagedIds]=useState<string[]>([]),inFlight=useRef(false);
  const open=["pending","approved","active","open","in_progress","quoted"].includes(status);
  const {suppliers,error:supplierError,loading,searching,reload}=useApprovedSuppliers(search,open,false,id);
  const excluded=new Set([...matchedSupplierIds,...stagedIds]);
  const options=suppliers.filter(s=>s.status==="APPROVED"&&s.isActive!==false&&!excluded.has(s.id));
  const selected=options.find(s=>s.id===supplierId);
  const missingReason=!!selected&&!note.trim();
  const canSubmit=open&&!!selected&&!!note.trim()&&!busy&&!loading&&!searching&&!supplierError;
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!canSubmit||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError("");setSuccess(false);
    const submittedId=selected!.id;
    try{
      await apiRequest(`/api/v1/admin/rfqs/${id}/manual-match`,{method:"POST",body:JSON.stringify({supplierId:submittedId,note:note.trim()})});
      setStagedIds(ids=>[...ids,submittedId]);setSupplierId("");setNote("");setSuccess(true);onRouted();
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not stage this supplier match. Please retry.");}
    finally{inFlight.current=false;setBusy(false);}
  }
  return <section className="card p-5 space-y-3" aria-label="Manual supplier routing"><h2 className="font-semibold">Manual supplier route</h2>
    {open?<form onSubmit={submit}><fieldset disabled={busy} className="grid sm:grid-cols-2 gap-4">
      <label className="text-sm">Search approved suppliers<input className="input mt-1" value={search} maxLength={100} onChange={e=>{setSearch(e.target.value);setSupplierId("");setError("");}} /></label>
      <label className="text-sm">Approved supplier<select className="input mt-1" required value={selected?supplierId:""} disabled={loading||searching} onChange={e=>{setSupplierId(e.target.value);setError("");setSuccess(false);}}><option value="">Select an approved supplier</option>{options.map(s=><option key={s.id} value={s.id}>{[s.companyName,s.user?.fullName,s.user?.email,s.status,s._count?.supplierCatalogEntries!=null?`${s._count.supplierCatalogEntries} catalog fabrics`:null,s._count?.wovenProducts!=null?`${s._count.wovenProducts} woven listings`:null,s._count?.capabilities!=null?`${s._count.capabilities} capabilities`:null].filter(Boolean).join(" · ")}</option>)}</select></label>
      <div className="text-sm sm:col-span-2"><label htmlFor="manual-routing-reason">Routing reason *</label><textarea id="manual-routing-reason" className="input mt-1" required maxLength={2000} value={note} aria-invalid={missingReason} aria-describedby={`manual-routing-help${missingReason?" manual-routing-validation":""}`} onChange={e=>setNote(e.target.value)}/><p id="manual-routing-help" className="mt-1 text-xs text-muted">Required for audit history. Explain why this supplier can fulfil this RFQ.</p>{missingReason&&<p id="manual-routing-validation" className="mt-1 text-sm text-red-700">Enter a routing reason before staging this supplier match.</p>}</div>
      <button className="btn-primary" disabled={!canSubmit}>{busy?"Staging supplier match…":"Stage manual match"}</button>
      {(loading||searching)&&<p role="status" className="text-sm text-muted">Loading approved suppliers…</p>}
      {!loading&&!searching&&!options.length&&!supplierError&&<p className="text-sm text-muted">No eligible approved suppliers found. Suppliers already matched to this RFQ are omitted.</p>}
    </fieldset></form>:<p className="text-sm text-muted">Sourcing is closed for this RFQ.</p>}
    {supplierError&&<div role="alert" className="text-sm text-red-700">{supplierError.message} <button className="underline" onClick={reload}>Retry supplier search</button></div>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {success&&<div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-lg">{successMessage}<button type="button" className="ml-2 underline" aria-label="Dismiss staging confirmation" onClick={()=>setSuccess(false)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor"/></svg></button></div>}
  </section>;
}
