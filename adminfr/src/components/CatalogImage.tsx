import { useState } from "react";
export function CatalogImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return failed === src ? <span role="img" aria-label={alt} className={`inline-flex items-center justify-center bg-slate-100 text-xs text-muted ${className}`}>Image unavailable</span>
    : <img src={src} alt={alt} width={160} height={160} loading="lazy" decoding="async" onError={() => setFailed(src)} className={className} />;
}
