import React, { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { PageHeading } from "../../../components/tables/AdminTable";
export function DashboardPage({
  onSelectSupplier,
  onNavigate,
}: {
  onSelectSupplier: (id: string) => void;
  onNavigate: (view: string) => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    apiRequest("/api/v1/admin/dashboard", { signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [revision]);
  const m = data?.platformMetrics,
    b = data?.buyerMetrics;
  return (
    <div className="space-y-6">
      <PageHeading title="Platform Metrics" />
      {error && (
        <div role="alert" className="card p-5 text-sm text-red-700">
          {error}
          <button
            onClick={() => setRevision((r) => r + 1)}
            className="ml-4 underline"
          >
            Retry
          </button>
        </div>
      )}
      {!data && !error && <p role="status">Loading metrics…</p>}
      {m && (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              ["Total Inquiries", m.totalInquiries, "text-primary"],
              ["Total Responses", m.totalResponses, "text-success"],
              [
                "Avg Response Time",
                `${Number(m.avgResponseTimeHours).toFixed(1)} hrs`,
                "text-amber-600",
              ],
            ].map(([label, value, color]) => (
              <article key={label} className="card p-6">
                <p className="label mb-3">{label}</p>
                <p className={`text-4xl font-semibold ${color}`}>{value}</p>
              </article>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              ["RFQ Requests", m.rfqInquiries, m.rfqResponses],
              ["Legacy Inquiries", m.legacyInquiries, m.legacyResponses],
            ].map(([label, inquiries, responses]) => (
              <article key={label} className="card p-5">
                <h2 className="label mb-3">{label}</h2>
                <div className="flex gap-8">
                  <div>
                    <strong className="text-2xl text-primary">
                      {inquiries}
                    </strong>
                    <p className="text-xs text-muted">inquiries</p>
                  </div>
                  <div>
                    <strong className="text-2xl text-success">
                      {responses}
                    </strong>
                    <p className="text-xs text-muted">responses</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <section className="card p-5">
            <h2 className="label mb-4">Buyers</h2>
            <div className="flex gap-8 flex-wrap">
              {[
                ["Registered", b.totalBuyers],
                ["Signups (30d)", b.signups30d],
                ["Accepted orders", b.acceptedOrdersTotal],
              ].map(([label, value]) => (
                <div key={label}>
                  <strong className="text-2xl text-primary">{value}</strong>
                  <p className="text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <section className="card p-5">
        <h2 className="text-sm text-muted mb-3">Admin workflow shortcuts</h2>
        <div className="flex gap-3 flex-wrap">
          {[
            ["suppliers", "Suppliers"],
            ["buyers", "Buyers"],
            ["rfq-approvals", "RFQ Approval Queue"],
            ["quote-approvals", "Quote Approval Queue"],
            ["catalog", "Supplier Catalog Control"],
            ["samples", "Sampling Requests"],
            ["accepted-orders", "Accepted Orders"],
          ].map(([view, label]) => (
            <button
              key={view}
              className="btn-ghost"
              onClick={() => onNavigate(view)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {data?.recentPending.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold mb-3">
            Recent pending suppliers
          </h2>
          {data.recentPending.map((s: any) => (
            <button
              key={s.id}
              className="block text-primary text-sm py-2"
              onClick={() => onSelectSupplier(s.id)}
            >
              {s.companyName} · {s.userEmail}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
