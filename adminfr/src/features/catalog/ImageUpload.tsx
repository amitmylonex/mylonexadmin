import { ImagePlus } from "lucide-react";
import React, { useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
export function ImageUpload({ supplierId, urls, onChange, single = false, onBusy }: { supplierId: string; urls: string[]; onChange: (urls: string[]) => void; single?: boolean; onBusy: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true); onBusy(true); setError("");
    const next = single ? [] : [...urls];
    try {
      if (files.length + next.length > (single ? 1 : 20)) throw new Error(`Select up to ${single ? 1 : 20} images.`);
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10*1024*1024) throw new Error("Use JPG, PNG or WEBP images up to 10MB each.");
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        const result = await apiRequest<{ imageUrl: string }>(`/api/v1/admin/suppliers/${supplierId}/catalog/images`, { method: "POST", body: JSON.stringify({ contentType: file.type, data }) });
        next.push(result.imageUrl); onChange([...next]);
      }
    } catch (e: any) { setError(e.message || "Upload failed"); }
    finally { setBusy(false); onBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className="catalog-upload"><span className="catalog-upload-title">{single ? "Collection image" : "Fabric images"}</span><label className="catalog-upload-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files);}}><span className="catalog-upload-icon"><ImagePlus size={17}/></span><span className="catalog-upload-copy"><strong>{busy ? "Uploading…" : "Click to select or drag images here"}</strong><small>Supports JPG, PNG, WEBP up to 10MB · {single ? "Single image" : "Multiple images allowed"}</small></span><span className="catalog-upload-browse">Browse Files</span><input ref={input} disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" multiple={!single} onChange={e=>upload(e.target.files)} className="sr-only" aria-label={single ? "Collection image" : "Fabric images"}/></label><p className="catalog-upload-help">{single ? "Only one cover image is stored for a collection." : "Optional for publishing, but the first image becomes the buyer-facing catalog preview."}</p>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<div className="flex flex-wrap gap-3">{urls.map((url,i)=><div key={url}><img src={url} alt={`Uploaded fabric ${i+1}`} className="h-20 w-20 rounded-lg object-cover"/><button type="button" disabled={busy} onClick={()=>onChange(urls.filter((_,j)=>i!==j))} className="text-xs text-red-700">Remove image {i+1}</button></div>)}</div></div>;
}
