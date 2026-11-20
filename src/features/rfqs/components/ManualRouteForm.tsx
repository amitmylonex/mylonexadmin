import React, {useEffect,useState} from "react";
import {apiRequest} from "../../../lib/api";
export function ManualRouteForm({id,status,onRouted}:{id:string;status:string;onRouted:()=>void}) {
  const [search,setSearch]=useState(""),[suppliers,setSuppliers]=useState<Array<{id:string;companyName:string}>>([]),[supplierId,setSupplierId]=useState("");
  const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const active=["approved","active","open","in_progress","quoted"].includes(status),pending=status==="pending";
  useEffect(()=>{
    if(!active&&!pending)return;
    const controller=new AbortController();const timer=setTimeout(()=>{apiRequest<any>("/api/v1/admin/suppliers?status=APPROVED&pageSize=25&search="+encodeURIComponent(search),{signal:controller.signal})
      .then(result=>{if(!controller.signal.aborted)setSuppliers(result.suppliers||[]);}).catch(error=>{if(!controller.signal.aborted){setSuppliers([]);setMessage(error.message);}});},300);
    return ()=>{controller.abort();clearTimeout(timer);};
  },[search,active,pending]);
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage("");try{const result=await apiRequest<any>(`/api/v1/admin/rfqs/${id}/manual-match`,{method:"POST",body:JSON.stringify({supplierId,note})});setMessage(result.notification.message);setSupplierId("");setNote("");onRouted();}catch(error:any){setMessage(error.message);}finally{setBusy(false);}}
  return <section className="card p-5 space-y-3" aria-label="Manual supplier routing"><h2 className="font-semibold">Manual supplier route</h2>
    {active||pending?<form onSubmit={submit}><fieldset disabled={busy} className="grid sm:grid-cols-2 gap-4">
      <label className="text-sm">Search approved suppliers<input className="input mt-1" value={search} maxLength={150} onChange={e=>{setSearch(e.target.value);setSupplierId("");}} /></label>
      <label className="text-sm">Approved supplier<select className="input mt-1" required value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Choose a supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.companyName}</option>)}</select></label>
      <label className="text-sm sm:col-span-2">Routing reason<textarea className="input mt-1" required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} /></label>
      <button className="btn-primary" disabled={!supplierId||!note.trim()}>{pending?"Stage manual match":"Route supplier"}</button>
    </fieldset></form>:<p className="text-sm text-muted">Sourcing is closed for this RFQ.</p>}
    {message&&<p role="status" className="text-sm">{message}</p>}
  </section>;
}
