const statuses=['all','not-attempted','sending','sent','delivered','read','quoted','declined','clarifying','failed','no-response','no-matches'];
export function TrackingFilters({list,from,to,onFrom,onTo,size,onSize,onClear}:{list:any;from:string;to:string;onFrom:(value:string)=>void;onTo:(value:string)=>void;size:string;onSize:(value:string)=>void;onClear:()=>void}) {
  return <section aria-label="Tracking filters" className="rounded-xl border border-border bg-white p-4 flex flex-wrap gap-4 items-end">
    <label className="flex-1 min-w-[200px] text-xs">Search RFQs<input className="input mt-1" type="search" maxLength={100} placeholder="RFQ number, fabric or supplier" value={list.search} onChange={e=>list.setSearch(e.target.value)}/></label>
    <label className="text-xs">Activity status<select className="input mt-1" value={list.status||'all'} onChange={e=>list.setStatus(e.target.value==='all'?'':e.target.value)}>{statuses.map(value=><option key={value} value={value}>{value.replace(/-/g,' ')}</option>)}</select></label>
    <label className="text-xs">Inquiry from (UTC)<input type="date" className="input mt-1" value={from} onChange={e=>onFrom(e.target.value)}/></label>
    <label className="text-xs">Inquiry to (UTC)<input type="date" className="input mt-1" value={to} onChange={e=>onTo(e.target.value)}/></label>
    <label className="text-xs">Rows per page<select className="input mt-1" value={size} onChange={e=>onSize(e.target.value)}>{[10,25,50].map(value=><option key={value}>{value}</option>)}</select></label>
    <button className="btn-outline" disabled={list.loading} onClick={list.reload}>Refresh tracking</button><button className="btn-ghost" onClick={onClear}>Clear filters</button>
  </section>;
}
