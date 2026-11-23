import React,{useEffect,useState} from "react";
import {apiRequest} from "../../lib/api";
import type {Kind} from "./fields";
import {CatalogIntegration} from "./original/integration";
import QuickAddForm from "./original/QuickAddForm";
import WovenListingForm from "./original/WovenListingForm";
import CapabilityForm from "./original/capabilities/CapabilityForm";
import ImageUploader from "./original/ImageUploader";
export type EditTarget={kind:Kind;id?:string};
export function CatalogEditor({supplierId,collections,target,onSaved,onClose}: {supplierId:string;collections:Array<{id:string;name:string;isArchived:boolean}>;target:EditTarget;onSaved:()=>void;onClose:()=>void;embedded?:boolean;onDraftChange?:(form:Record<string,any>)=>void}){
  const [item,setItem]=useState<any>(null),[error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();setItem(null);setError("");if(!target.id)return;
    apiRequest<any>(`/api/v1/admin/suppliers/${supplierId}/catalog/manage/${target.kind}/${target.id}`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setItem(result.item);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();
  },[supplierId,target.kind,target.id]);
  const base=`/api/v1/admin/suppliers/${supplierId}/catalog`;
  return <CatalogIntegration onSaved={()=>{onSaved();onClose();}} onClose={onClose}><section className="supplier-catalog-workspace card p-6 space-y-4 min-w-0" aria-label={`Edit ${target.kind}`}>
    <div className="flex justify-between gap-3"><h2 className="text-lg font-bold">Edit {target.kind==="fabrics"?"Fabric Listing":target.kind==="woven"?"Woven Listing":target.kind==="capabilities"?"Capability":"Collection"}</h2><button className="btn-outline text-xs" onClick={onClose}>Close editor</button></div>
    {error?<p role="alert">{error}</p>:!item?<p role="status">Loading editor…</p>:target.kind==="fabrics"?<QuickAddForm mode="edit" listingId={target.id} apiBasePath={base} initialData={{...item,fabricCollection:item.fabricCollection||collections.find(c=>c.id===item.fabricCollectionId)}}/>:target.kind==="woven"?<WovenListingForm mode="edit" listingId={target.id} apiBasePath={base} initialData={item}/>:target.kind==="capabilities"?<CapabilityForm mode="edit" capabilityId={target.id} apiBasePath={base} initialData={item}/>:<CollectionEdit item={item} base={base} onSaved={()=>{onSaved();onClose();}}/>}
  </section></CatalogIntegration>;
}
function CollectionEdit({item,base,onSaved}:{item:any;base:string;onSaved:()=>void}){
  const [name,setName]=useState(item.name),[images,setImages]=useState<string[]>(item.imageUrl?[item.imageUrl]:[]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);try{await apiRequest(`${base}/manage/collections/${item.id}`,{method:"PUT",body:JSON.stringify({name,imageUrl:images[0]||null})});onSaved();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  return <form onSubmit={save} className="space-y-4">{error&&<p role="alert">{error}</p>}<label className="block text-sm font-semibold">Collection Name<input className="input mt-1.5" required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><ImageUploader label="Collection Image" value={images} onChange={urls=>setImages(urls.slice(-1))} uploadEndpoint={`${base}/images`}/><button className="btn-primary" disabled={busy}>Save changes</button></form>;
}
