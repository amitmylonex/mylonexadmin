import { useAdminList } from "../../../hooks/useAdminList";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton";
import React from "react";

interface CatalogSupplier {
  id: string;
  companyName: string;
  status: string;
  user: { email: string };
  _count: {
    supplierCatalogEntries: number;
    wovenProducts: number;
    fabricCollections: number;
    capabilities: number;
  };
}

export function CatalogControlPage({ onSelectSupplier }: { onSelectSupplier: (id: string) => void }) {
  const list = useAdminList<CatalogSupplier>("/api/v1/admin/catalog/suppliers", "suppliers");
  const { page, setPage, totalPages, search, setSearch, error, items: suppliers, loading } = list;
  if (loading && suppliers.length === 0 && !search && page === 1) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSkeleton label="Loading supplier catalog" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Admin Console</p>
        <h1 className="text-2xl font-semibold text-ink">Supplier Catalog Control</h1>
        <p className="mt-1 text-sm text-ink/60">
          View and audit supplier collections, fabric listings, and mill capabilities.
        </p>
      </div>

      {error && <p role="alert" className="text-red-700">{error}<button className="ml-3 underline" onClick={list.reload}>Retry</button></p>}
      <div className="flex items-center gap-3"><label className="text-xs">Search suppliers<input className="input ml-2" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><button className="btn-outline text-xs" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Previous</button><span className="text-xs">Page {page} of {totalPages}</span><button className="btn-outline text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next</button></div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink/60">No suppliers found.</div>
        ) : (
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-canvas text-left text-ink/60 font-medium">
              <tr>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Account Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Fabrics / Catalog</th>
                <th className="px-6 py-4">Woven Products</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-ink/5 transition-colors">
                  <td className="px-6 py-4 font-semibold text-ink">{s.companyName}</td>
                  <td className="px-6 py-4 text-ink/60 font-mono text-xs">{s.user.email}</td>
                  <td className="px-6 py-4 text-xs">
                    <span className="badge bg-slate-100 text-ink/80 border border-border">
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-primary">
                    {s._count.supplierCatalogEntries} entries
                  </td>
                  <td className="px-6 py-4 text-xs text-ink/70">
                    {s._count.wovenProducts} items
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onSelectSupplier(s.id)}
                      className="btn-ghost text-xs px-3 py-1 font-semibold text-primary"
                    >
                      Inspect Profile →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
