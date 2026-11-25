import {useState} from "react";
import type {RfqDetail} from "../types";
import {humanize,quantity,safeImage} from "../utils/presentation";
const privateKey=/token|secret|authorization|session|password/i;
const technical=/warp|weft|epi|ppi|count|ply|construction|templateSpecs/i;
const extraction=/^(originally inferred|inferred |parser|parsing|extraction|mapped from|debug)/i;
function rows(value:unknown,prefix=""):Array<[string,string]> {
  if(!value||typeof value!=="object")return [];
  return Object.entries(value).slice(0,80).flatMap(([key,item]):Array<[string,string]>=>{
    if(privateKey.test(key)||/notes|originalRequirement|originalText/i.test(key))return [];
    if(item==null||!humanize(typeof item==="object"?"object":item))return [];
    if(Array.isArray(item))return item.slice(0,40).flatMap(entry=>typeof entry==="object"&&entry?Object.prototype.hasOwnProperty.call(entry,"specKey")?[[humanize(entry.specKey),humanize(entry.valueNum??entry.valueText)]]:rows(entry,humanize(key)): [[humanize(key),humanize(entry)]]);
    if(typeof item==="object")return rows(item,humanize(key));
    return [[humanize(prefix?`${prefix} ${key}`:key),String(item)]];
  }).filter(([,value])=>humanize(value));
}
export function RfqRequirementEvidence({rfq}:{rfq:RfqDetail}) {
  const [failed,setFailed]=useState<string[]>([]),spec=rfq.specPayload||{},data=(spec.data||{}) as Record<string,unknown>;
  const lines=(rfq.buyerMessage||"").split(/\r?\n/).filter(line=>line.trim()&&!/^(?:[^:]+:\s*)?(undefined|null)$/i.test(line.trim()));
  const notes=[...lines.filter(line=>extraction.test(line.trim())),...[spec.extractionNotes,spec.parsingNotes,data.extractionNotes,data.parsingNotes].flatMap(v=>Array.isArray(v)?v.map(String):typeof v==="string"?[v]:[])];
  const buyerMessage=lines.filter(line=>!extraction.test(line.trim())).join("\n");
  const original=spec.originalRequirement||spec.originalText;
  const requirement=Object.fromEntries(Object.entries(data).filter(([key])=>!technical.test(key))),tech=Object.fromEntries(Object.entries(data).filter(([key])=>technical.test(key)));
  const shades=Array.isArray(spec.selectedShades)?spec.selectedShades as Array<Record<string,unknown>>:[];
  return <div className="space-y-5">
    {buyerMessage&&<section className="border-t border-border pt-4"><h3 className="font-semibold">Buyer message</h3><p className="mt-2 text-sm whitespace-pre-wrap break-words">{buyerMessage}</p></section>}
    {[['Full requirement specs',requirement],['Technical specs',tech]].map(([title,value])=>{const fields=rows(value);return fields.length?<section key={String(title)} className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold mb-4">{String(title)}</h3><dl className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">{fields.map(([label,item],index)=><div key={index}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words">{humanize(item)}</dd></div>)}</dl></section>:null;})}
    {!!rfq.buyerImageUrls?.length&&<section><h3 className="font-semibold mb-3">Buyer reference images</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{rfq.buyerImageUrls.filter(safeImage).map(url=>failed.includes(url)?<p key={url} className="text-xs text-muted">Reference image unavailable</p>:<a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Buyer fabric reference" loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full rounded-lg object-cover" onError={()=>setFailed(list=>[...list,url])}/></a>)}</div></section>}
    {!!shades.length&&<section><h3 className="font-semibold mb-3">Selected shades ({shades.length})</h3><div className="grid sm:grid-cols-3 gap-3">{shades.map((shade,index)=><div className="rounded-lg border border-border p-3 text-sm" key={index}>{humanize(shade.name)||`Shade ${index+1}`}{humanize(shade.code)&&<p>{humanize(shade.code)}</p>}</div>)}</div>{spec.quantityPerShadeMeters!=null&&<p className="text-sm mt-2">{quantity(spec.quantityPerShadeMeters)} per shade · {quantity(spec.totalQuantityMeters??rfq.quantity)} total</p>}</section>}
    {notes.length>0&&<details className="border-t border-border pt-3"><summary className="text-sm font-semibold cursor-pointer">Extraction notes (Admin only)</summary><ul className="mt-3 text-xs text-muted space-y-2">{notes.map((note,index)=><li key={index}>{note}</li>)}</ul></details>}
    {typeof original==="string"&&humanize(original)&&<details className="border-t border-border pt-3"><summary className="text-sm font-semibold cursor-pointer">Original submitted requirement</summary><p className="mt-3 text-sm whitespace-pre-wrap break-words">{original}</p></details>}
  </div>;
}
