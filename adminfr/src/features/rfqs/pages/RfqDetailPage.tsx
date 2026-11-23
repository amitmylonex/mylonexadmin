import React, { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useAdminList } from "../../../hooks/useAdminList";
import {
  AdminTable,
  PageHeading,
  ListFeedback,
  Pagination,
  Status,
  money,
  date,
} from "../../../components/tables/AdminTable";
export function RfqDetailPage({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const list = useAdminList(`/api/v1/admin/rfqs/${id}`, "unused");
  const [search, setSearch] = useState(""),
    [suppliers, setSuppliers] = useState<any[]>([]),
    [supplierId, setSupplierId] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const c = new AbortController(),
      timer = setTimeout(
        () =>
          apiRequest<any>(
            "/api/v1/admin/suppliers?status=APPROVED&pageSize=25&search=" +
              encodeURIComponent(search),
            { signal: c.signal },
          )
            .then((r) => setSuppliers(r.suppliers))
            .catch((e) => {
              if (!c.signal.aborted) setMessage(e.message);
            }),
        300,
      );
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [search]);
  const rfq = list.data?.rfq;
  async function manual(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await apiRequest<any>(`/api/v1/admin/rfqs/${id}/manual-match`, {
        method: "POST",
        body: JSON.stringify({ supplierId, note }),
      });
      setMessage(result.notification?.message || "Manual supplier routing saved.");
      list.reload();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <button className="text-primary text-sm" onClick={onBack}>
        ← Back to all RFQs
      </button>
      <PageHeading
        title={rfq?.rfqNumber || "RFQ detail"}
        description={rfq?.fabricName}
      />
      <ListFeedback list={list} />
      {rfq && (
        <>
          <section className="card p-6 grid sm:grid-cols-3 gap-5 text-sm">
            <div>
              <p className="text-muted">Requester</p>
              <strong>{rfq.buyer.fullName || rfq.buyer.email}</strong>
              <p>{rfq.buyer.email}</p>
              <p>{rfq.requesterRole}</p>
            </div>
            <div>
              <p className="text-muted">Requirements</p>
              <strong>{rfq.quantity} m</strong>
              <p>Delivery {rfq.deliveryPincode}</p>
              <p>{date(rfq.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted">Recorded status</p>
              <Status value={rfq.status} />
              <p>{rfq._count.matches} supplier matches</p>
            </div>
            <details className="sm:col-span-3">
              <summary>Fabric specification</summary>
              <dl className="mt-3 grid sm:grid-cols-3 gap-3">
                {Object.entries(rfq.specPayload || {})
                  .filter(([, v]) => v == null || typeof v !== "object")
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted">{k}</dt>
                      <dd>{String(v ?? "—")}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          </section>
          <section className="card p-6">
            <h2 className="text-lg font-bold mb-4">Add supplier manually</h2>
            <form onSubmit={manual} className="grid sm:grid-cols-3 gap-4">
              <label className="text-xs">
                Find approved supplier
                <input
                  className="input mt-1"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Supplier
                <select
                  className="input mt-1"
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Matching reason
                <input
                  className="input mt-1"
                  required
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button
                className="btn-primary justify-self-start"
                disabled={busy}
              >
                Add match for review
              </button>
            </form>
            <p className="mt-4 text-xs text-muted">
              Automatic re-matching is awaiting verified migration of the
              canonical matching engine.
            </p>
          </section>
          {message && (
            <p role="status" className="card p-4 text-sm">
              {message}
            </p>
          )}
          <AdminTable
            items={rfq.matches}
            columns={[
              {
                label: "Supplier",
                render: (m: any) => (
                  <>
                    {m.supplier.companyName}
                    <p className="text-xs text-muted">
                      {m.supplier.user.email}
                    </p>
                  </>
                ),
              },
              {
                label: "Source / score",
                render: (m: any) => (
                  <>
                    {m.sourceType} · {m.score}
                    <p className="text-xs text-muted">{m.explanation}</p>
                  </>
                ),
              },
              {
                label: "Review",
                render: (m: any) => (
                  <>
                    <Status value={m.status} />
                    <p className="text-xs mt-2">{m.adminReviewNote}</p>
                    <p className="text-xs text-muted">
                      {date(m.adminReviewedAt)}
                    </p>
                  </>
                ),
              },
              {
                label: "Quote",
                render: (m: any) =>
                  m.response ? (
                    <>
                      {money(m.response.price)} / m
                      <p className="text-xs text-muted">
                        MOQ {m.response.moq || "—"} · {m.response.leadTimeDays}{" "}
                        days
                      </p>
                      <Status value={m.response.status} />
                    </>
                  ) : (
                    "Awaiting response"
                  ),
              },
            ]}
          />
          <Pagination list={list} />
        </>
      )}
    </div>
  );
}
