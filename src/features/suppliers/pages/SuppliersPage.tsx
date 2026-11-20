import { useEffect, useState, type MouseEvent } from "react";
import { apiRequest } from "../../../lib/api";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { SupplierStatusBadge } from "../../../components/Badge";
import { StatusUpdateModal } from "../../../components/StatusUpdateModal";
import { CreateSupplierForm } from "../../../components/CreateSupplierForm";

interface SupplierItem {
  id: string; companyName: string; city: string | null; status: string; whatsappConsent: boolean;
  user: { email: string }; _count: { supplierCatalogEntries: number };
}
export function SuppliersPage({ onSelectSupplier, onManageCatalog }: {
  onSelectSupplier: (id: string) => void; onManageCatalog?: (id: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search);
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1), [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<SupplierItem | null>(null);
  const reload = () => setRevision(value => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const query = new URLSearchParams({ search: term, status, page: String(page), pageSize: String(pageSize) });
    apiRequest<{ suppliers: SupplierItem[]; totalCount: number; totalPages: number }>(`/api/v1/admin/suppliers?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) {
        setSuppliers(result.suppliers); setTotalPages(result.totalPages); setTotalCount(result.totalCount);
        if (page > result.totalPages) setPage(Math.max(1, result.totalPages));
      } }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || "Could not load suppliers"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [term, status, page, pageSize, revision]);
  const follow = (event: MouseEvent<HTMLAnchorElement>, id: string, catalog = false) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (catalog && !onManageCatalog) return;
    event.preventDefault();
    (catalog ? onManageCatalog! : onSelectSupplier)(id);
  };
  return <div className="space-y-6">
    <header><p className="label">Admin Console</p><h1 className="text-2xl font-semibold">Manage Suppliers</h1>
      <p className="mt-2 text-sm text-muted">Approve or suspend suppliers. Only approved suppliers will be included in matching and can receive inquiries.</p></header>
    <CreateSupplierForm onSupplierCreated={() => { setPage(1); setStatus("PENDING"); reload(); }} />
    <section className="card p-4 flex flex-wrap items-center justify-between gap-4" aria-label="Supplier filters">
      <div className="flex flex-wrap gap-2">{[["ALL", "All"], ["APPROVED", "Approved"], ["SUSPENDED", "Suspended"], ["PENDING", "Pending"]].map(([value, label]) =>
        <button key={value} type="button" aria-pressed={status === value} className={status === value ? "btn-primary text-xs" : "btn-ghost text-xs"}
          onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div>
      <label className="text-xs">Search suppliers<input type="search" className="input ml-2" maxLength={200} placeholder="Company, email or city" value={search}
        onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    </section>
    {error && <div role="alert" className="card p-4 text-rose-700">{error}<button className="btn-outline ml-3" onClick={reload}>Retry</button></div>}
    <div className="overflow-x-auto rounded-2xl border border-border bg-white" aria-busy={loading}>
      <table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-muted"><tr>
        {["Company", "Email", "Location", "Status", "WhatsApp", "Catalog", "Actions"].map(label => <th key={label} scope="col" className="p-4">{label}</th>)}
      </tr></thead><tbody className="divide-y divide-border">
        {loading ? <tr><td colSpan={7} className="p-10 text-center" role="status">Loading suppliers…</td></tr> : suppliers.map(supplier => <tr key={supplier.id}>
          <td className="p-4 font-semibold"><a className="text-primary hover:underline" href={`/admin/suppliers/${supplier.id}`} onClick={event => follow(event, supplier.id)}>{supplier.companyName}</a></td>
          <td className="p-4 text-muted">{supplier.user.email}</td><td className="p-4">{supplier.city || "—"}</td>
          <td className="p-4"><SupplierStatusBadge status={supplier.status} /></td>
          <td className="p-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs ${supplier.whatsappConsent ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{supplier.whatsappConsent ? "Consented" : "Not recorded"}</span></td>
          <td className="p-4"><a className="text-primary hover:underline" href={`/admin/suppliers/${supplier.id}/catalog`} onClick={event => follow(event, supplier.id, true)}>Manage Catalog</a><p className="text-xs text-muted mt-1">{supplier._count.supplierCatalogEntries} fabrics</p></td>
          <td className="p-4"><select className="input text-xs" aria-label={`Actions for ${supplier.companyName}`} value="" onChange={event => {
            if (event.target.value === "settings") onSelectSupplier(supplier.id);
            else if (event.target.value === "status") setTarget(supplier);
          }}><option value="" disabled>Actions</option><option value="settings">Settings</option><option value="status">{supplier.status === "APPROVED" ? "Suspend" : "Approve"}</option></select></td>
        </tr>)}
        {!loading && !suppliers.length && <tr><td colSpan={7} className="p-10 text-center text-muted">No suppliers found. Try another search or status.</td></tr>}
      </tbody></table>
    </div>
    <div className="flex flex-wrap justify-between gap-4 items-center text-xs text-muted">
      <span>{totalCount} suppliers · Page {page} of {totalPages}</span>
      <label>Rows per page <select className="input ml-2" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[15, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label>
      <div className="flex gap-2"><button className="btn-outline" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button className="btn-outline" disabled={loading || page >= totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </div>
    {target && <StatusUpdateModal supplierId={target.id} companyName={target.companyName} currentStatus={target.status} isOpen onClose={() => setTarget(null)} onSuccess={reload} />}
  </div>;
}
