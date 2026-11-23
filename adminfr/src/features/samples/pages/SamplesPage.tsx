import React,{useEffect,useState} from "react";
import {useAdminList} from "../../../hooks/useAdminList";
import {apiRequest} from "../../../lib/api";
import {AdminTable,PageHeading,QueryToolbar,ListFeedback,Pagination,Status,date,money} from "../../../components/tables/AdminTable";
import {Dialog} from "../../../components/ui/Dialog";
import {sampleTotal} from "../../../lib/sample-money.mjs";
const policies={full:"Full refund upon bulk order",partial:"Partial refund upon bulk order",none:"No refund"};
const emptyForm={quoteSampleCostInr:"",quoteCourierCostInr:"",quoteDeliveryTimeline:"",quoteRefundPolicy:"none",quoteValidUntil:"",quoteInternalNotes:"",supplierId:""};
export function SamplesPage(){
  const list=useAdminList("/api/v1/admin/samples","samples");
  const [target,setTarget]=useState<any>(null),[mode,setMode]=useState<"quote"|"view"|"delivered">("view"),[form,setForm]=useState(emptyForm);
  const [reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [courier,setCourier]=useState({courierName:"",courierTrackingNumber:""}),[search,setSearch]=useState(""),[suppliers,setSuppliers]=useState<any[]>([]);
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get("search");if(value)list.setSearch(value.slice(0,150));},[]);
  useEffect(()=>{
    if(!target||mode!=="quote")return;
    const controller=new AbortController();const timer=setTimeout(()=>apiRequest<any>("/api/v1/admin/suppliers?status=APPROVED&pageSize=25&search="+encodeURIComponent(search),{signal:controller.signal})
      .then(result=>{if(!controller.signal.aborted)setSuppliers(result.suppliers||[]);}).catch(failure=>{if(!controller.signal.aborted){setSuppliers([]);setError(failure.message);}}),300);
    return()=>{controller.abort();clearTimeout(timer);};
  },[search,target,mode]);
  function open(sample:any,next:typeof mode){setTarget(sample);setMode(next);setReason("");setError("");setSearch("");setSuppliers([]);setForm({...emptyForm,supplierId:sample.fulfillmentSupplier?.status==="APPROVED"?sample.fulfillmentSupplier.id:""});setCourier({courierName:"",courierTrackingNumber:""});}
  const total=sampleTotal(form.quoteSampleCostInr,form.quoteCourierCostInr);
  const options=[...(target?.fulfillmentSupplier?.status==="APPROVED"?[target.fulfillmentSupplier]:[]),...suppliers.filter(s=>s.id!==target?.fulfillmentSupplier?.id)];
  async function save(action:"quote"|"reject"|"delivered"){
    if(!target)return;setBusy(true);setError("");
    try{
      const body=action==="quote"?{...form,quoteValidUntil:new Date(form.quoteValidUntil+":00+05:30").toISOString()}:action==="reject"?{rejectionReason:reason}:courier;
      const result=await apiRequest<any>(`/api/v1/admin/samples/${target.id}/${action}`,{method:"POST",body:JSON.stringify(body)});
      setMessage(action==="quote"?`Sample quote released. Total ${money(result.totalSampleCostInr)}. ${result.notification?.message||""}`:action==="reject"?"Sample request rejected.":"Physical delivery and order tracking recorded.");setTarget(null);list.reload();
    }catch(failure:any){setError(failure.message||"Check the sample values.");}finally{setBusy(false);}
  }
  return <div className="space-y-6">
    <PageHeading title="Sampling Requests" description="Prepare sample quotations, review buyer decisions and record physical deliveries."/>
    <QueryToolbar list={list} statuses={["requested","quoted","accepted_by_buyer","rejected_by_buyer","rejected","delivered"].map(value=>({value,label:value.replace(/_/g," ")}))}/><ListFeedback list={list}/>
    {message&&<p role="status" className="card p-4 text-sm">{message}</p>}
    <AdminTable items={list.items} empty="No sampling requests found." columns={[
      {label:"Sample #",render:s=><strong>{s.sampleNumber}</strong>},
      {label:"Buyer",render:s=><>{s.buyer.fullName||s.buyer.email}<p className="text-xs text-muted">{s.buyer.email}</p></>},
      {label:"Fabric Requested",render:s=><>{s.fabricName}<p className="text-xs text-muted">{s.composition} · {s.gsm} GSM</p></>},
      {label:"Meters",render:s=>`${s.quantityMeters} m`},
      {label:"Delivery Pincode",render:s=>s.pincode},
      {label:"Status",render:s=><Status value={s.status}/>},
      {label:"Actions",render:s=><div className="flex gap-2 flex-wrap"><button className="btn-outline text-xs whitespace-nowrap" onClick={()=>open(s,s.status==="requested"?"quote":"view")}>{s.status==="requested"?"Prepare Sample Quote":"View details"}</button>{s.status==="accepted_by_buyer"&&<button className="btn-primary text-xs whitespace-nowrap" disabled={!s.order?.id} title={!s.order?.id?"Acceptance has no linked order; reconciliation required":undefined} onClick={()=>open(s,"delivered")}>Mark Delivered</button>}</div>},
    ]}/><Pagination list={list}/>
    <Dialog open={!!target&&mode!=="delivered"} variant="drawer" title={mode==="quote"?"Prepare Sample Quote":"Sample details"} busy={busy} onClose={()=>setTarget(null)}>
      {target&&<div className="space-y-5"><p className="text-sm font-semibold">{target.sampleNumber} · {target.fabricName} · {target.quantityMeters} m</p><p className="text-sm">{target.deliveryAddress} · {target.pincode}</p>{error&&<p role="alert" className="text-red-800 bg-red-50 p-3 rounded-lg">{error}</p>}
        {mode==="quote"?<><form onSubmit={e=>{e.preventDefault();if(total!==null)save("quote");}}><fieldset disabled={busy} className="space-y-4">
          <p className="text-xs text-muted">Enter the total sample yardage charge, rather than a rate per metre. Buyer notification delivery is handled separately.</p>
          <label className="block text-sm">Sample yardage charge (INR)<input className="input mt-1" type="number" min="0" max="9999999999.99" step="0.01" required value={form.quoteSampleCostInr} onChange={e=>setForm(f=>({...f,quoteSampleCostInr:e.target.value}))}/></label>
          <label className="block text-sm">Courier charge (INR)<input className="input mt-1" type="number" min="0" max="9999999999.99" step="0.01" required value={form.quoteCourierCostInr} onChange={e=>setForm(f=>({...f,quoteCourierCostInr:e.target.value}))}/></label>
          <p role="status" className="rounded-xl bg-blue-50 p-4 text-lg font-semibold">Total sample cost: {total!==null?money(total):"Enter valid charges"}</p>
          <label className="block text-sm">Delivery timeline<input className="input mt-1" required maxLength={500} placeholder="3-5 business days" value={form.quoteDeliveryTimeline} onChange={e=>setForm(f=>({...f,quoteDeliveryTimeline:e.target.value}))}/></label>
          <label className="block text-sm">Refund policy<select aria-label="Refund policy" className="input mt-1" value={form.quoteRefundPolicy} onChange={e=>setForm(f=>({...f,quoteRefundPolicy:e.target.value}))}>{Object.entries(policies).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-sm">Quote valid until (IST)<input className="input mt-1" type="datetime-local" required value={form.quoteValidUntil} onChange={e=>setForm(f=>({...f,quoteValidUntil:e.target.value}))}/></label>
          <label className="block text-sm">Search approved suppliers<input className="input mt-1" value={search} maxLength={150} onChange={e=>{setSearch(e.target.value);setForm(f=>({...f,supplierId:""}));}}/></label>
          <label className="block text-sm">Fulfillment supplier<select aria-label="Fulfillment supplier" className="input mt-1" required value={form.supplierId} onChange={e=>setForm(f=>({...f,supplierId:e.target.value}))}><option value="">Choose approved supplier</option>{options.map(s=><option key={s.id} value={s.id}>{s.companyName}</option>)}</select></label>
          <label className="block text-sm">Admin internal notes<textarea className="input mt-1" maxLength={5000} value={form.quoteInternalNotes} onChange={e=>setForm(f=>({...f,quoteInternalNotes:e.target.value}))}/></label>
          <button className="btn-primary w-full" disabled={total===null||!form.supplierId}>Release sample quote</button>
        </fieldset></form><form className="border-t border-border pt-4 space-y-3" onSubmit={e=>{e.preventDefault();if(reason.trim())save("reject");}}><label className="block text-sm">Rejection reason<textarea className="input mt-1" required maxLength={1000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label><button className="btn-outline w-full" disabled={busy||!reason.trim()}>Reject sample request</button></form></>:<section className="space-y-3 text-sm">
          <Status value={target.status}/><p>Sample charge: {money(target.quoteSampleCostInr)} · Courier: {money(target.quoteCourierCostInr)}</p><p>Total sample cost: {money(sampleTotal(target.quoteSampleCostInr,target.quoteCourierCostInr))}</p><p>{target.quoteDeliveryTimeline}</p><p>Refund policy: {policies[target.quoteRefundPolicy as keyof typeof policies]||"Not recorded"}</p><p>Valid until: {date(target.quoteValidUntil)}</p><p>Fulfillment supplier: {target.fulfillmentSupplier?.companyName||"Not assigned"}</p><p>Admin internal notes: {target.quoteInternalNotes||"None"}</p>{target.rejectionReason&&<p>Rejection reason: {target.rejectionReason}</p>}<p>Order: {target.order?.orderNumber||"No linked order"}</p><p>Delivered: {date(target.deliveredAt)}</p><p>Courier: {target.courierName||"Not recorded"} · Tracking: {target.courierTrackingNumber||"Not recorded"}</p>
        </section>}
      </div>}
    </Dialog>
    <Dialog open={!!target&&mode==="delivered"} title="Mark sample delivered" busy={busy} onClose={()=>setTarget(null)}>
      <p className="text-sm mb-4">Confirm physical delivery of {target?.sampleNumber}. This also updates its linked order.</p>{error&&<p role="alert" className="text-red-800 mb-4">{error}</p>}
      <form onSubmit={e=>{e.preventDefault();save("delivered");}}><fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Courier name<input className="input mt-1" required maxLength={100} value={courier.courierName} onChange={e=>setCourier(c=>({...c,courierName:e.target.value}))}/></label><label className="block text-sm">Tracking code<input className="input mt-1" required maxLength={120} value={courier.courierTrackingNumber} onChange={e=>setCourier(c=>({...c,courierTrackingNumber:e.target.value}))}/></label><button className="btn-primary" disabled={!courier.courierName.trim()||!courier.courierTrackingNumber.trim()}>Confirm physical delivery</button></fieldset></form>
    </Dialog>
  </div>;
}
