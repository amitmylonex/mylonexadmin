export function LoadingSkeleton({ label = "Loading records", rows = 4 }: { label?: string; rows?: number }) {
  return <div role="status" aria-label={label} className="space-y-3 p-5 w-full">
    <span className="sr-only">{label}…</span>
    {Array.from({ length: rows }, (_, i) => <div key={i} aria-hidden="true" className="h-12 rounded-lg bg-slate-100 motion-safe:animate-pulse" />)}
  </div>;
}
