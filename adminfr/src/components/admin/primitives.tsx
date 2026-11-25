import type {ReactNode} from "react";
export {PageHeading as PageHeader,AdminTable as DataTable,Status as StatusBadge} from "../tables/AdminTable";
export {Dialog as ConfirmActionDialog} from "../ui/Dialog";
export {LoadingSkeleton} from "../LoadingSkeleton";
export {EmptyState} from "../EmptyState";
export function FilterPanel({children}:{children:ReactNode}) {return <section className="card p-4 flex flex-wrap items-end gap-4">{children}</section>;}
export function MetricCard({label,value,hint}:{label:string;value:ReactNode;hint?:string}) {return <article className="card p-4" title={hint}><p className="text-xs text-muted">{label}</p><strong className="block text-2xl mt-2">{value}</strong></article>;}
export function ErrorState({message,onRetry}:{message:string;onRetry:()=>void}) {return <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{message}<button className="ml-3 underline" onClick={onRetry}>Retry</button></div>;}
