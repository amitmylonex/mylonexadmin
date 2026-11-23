import { useId, useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { AdminTable, PageHeading, ListFeedback, Pagination, Status, date, money, type Column } from "../../../components/tables/AdminTable";
import { Badge } from "../../../components/Badge";
import type { AdminBuyerProfile, BuyerActivity, BuyerOrderSummary } from "../../../contracts/buyer-contracts";
type Tab = "rfqs" | "samples" | "orders";
export function BuyerDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("rfqs");
  const prefix = useId();
  const list = useAdminList<BuyerActivity>(`/api/v1/admin/buyers/${id}`, "activity", { tab });
  const buyer = list.data?.buyer as AdminBuyerProfile | undefined;
  const summary = list.data?.orderSummary as BuyerOrderSummary | undefined;
  const current = list.data?.tab === tab;
  const columns: Column<BuyerActivity>[] = tab === "rfqs" ? [
    { label: "RFQ Number", render: row => row.rfqNumber || "—" }, { label: "Fabric Name", render: row => row.fabricName || "—" },
    { label: "Quantity", render: row => row.quantity != null ? `${row.quantity.toLocaleString("en-IN")} m` : "—" },
    { label: "Status", render: row => <Status value={row.status} /> }, { label: "Created Date", render: row => date(row.createdAt) },
  ] : tab === "samples" ? [
    { label: "Sample Number", render: row => row.sampleNumber || "—" }, { label: "Fabric Name", render: row => row.fabricName || "—" },
    { label: "Sample Type", render: row => row.sampleType?.replace(/_/g, " ") || "—" },
    { label: "Status", render: row => <Status value={row.status} /> }, { label: "Created Date", render: row => date(row.createdAt) },
  ] : [
    { label: "Order Number", render: row => row.orderNumber || "—" }, { label: "Order Type", render: row => row.orderType || "—" },
    { label: "Status", render: row => <Status value={row.status} /> },
    { label: "Total Value (estimate)", render: row => row.totalValueEstimate == null ? "Not available" : money(row.totalValueEstimate) },
    { label: "Created Date", render: row => date(row.createdAt) },
  ];
  return <div className="space-y-6">
    <button className="text-primary text-sm" onClick={onBack}>← Back to buyers</button>
    <PageHeading title={buyer?.fullName || buyer?.buyerProfile?.company || "Buyer profile"} description={buyer?.email} />
    <ListFeedback list={list} />
    {buyer && <>
      <section className="card p-6 space-y-5" aria-label="Buyer overview">
        <div className="flex flex-wrap gap-2">
          {buyer.verification?.emailVerified === true ? <Badge variant="success">Email verified</Badge> : buyer.verification?.emailVerified === false ? <Badge variant="warning">Email not verified</Badge> : <Badge variant="outline">Email verification not recorded</Badge>}
          {buyer.buyerProfile?.gstNumber && <Badge variant="outline">GST recorded</Badge>}
          <Badge variant="default">Buyer account</Badge>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 text-sm">{[
          ["Contact person", buyer.fullName], ["Company", buyer.buyerProfile?.company], ["Phone", buyer.buyerProfile?.phone],
          ["City", buyer.buyerProfile?.city], ["GST Number", buyer.buyerProfile?.gstNumber], ["Billing Address", buyer.billingAddress], ["Joined", date(buyer.createdAt)],
        ].map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-1 font-semibold break-words">{value || "Not recorded"}</p></div>)}</div>
      </section>
      {summary && <section aria-label="Buyer order summary" className="space-y-3"><div className="grid gap-4 sm:grid-cols-3">
        {[["Orders", summary.totalCount], ["Production / Sampling", `${summary.productionCount} / ${summary.sampleCount}`], ["Known order value estimate", summary.totalValueEstimateInr == null ? "Not available" : money(summary.totalValueEstimateInr)]].map(([label, value]) => <div key={label} className="card p-5"><p className="label">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}
        </div><p className="text-xs text-muted">{summary.basis}{summary.unknownValueCount > 0 ? ` ${summary.unknownValueCount} ${summary.unknownValueCount === 1 ? "order has" : "orders have"} no value estimate.` : ""}</p></section>}
      <div role="tablist" aria-label="Buyer activity" className="flex gap-2 flex-wrap" onKeyDown={event => {
        const values: Tab[] = ["rfqs", "samples", "orders"];
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (values.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
        setTab(values[next]); list.setPage(1); document.getElementById(`${prefix}-${values[next]}`)?.focus();
      }}>{([["rfqs", "Production RFQs"], ["samples", "Sample Requests"], ["orders", "Orders"]] as const).map(([value, label]) =>
        <button key={value} role="tab" tabIndex={tab === value ? 0 : -1} id={`${prefix}-${value}`} aria-selected={tab === value} aria-controls={`${prefix}-activity`} className={tab === value ? "btn-primary" : "btn-outline"} onClick={() => { setTab(value); list.setPage(1); }}>{label}</button>)}</div>
      <section role="tabpanel" id={`${prefix}-activity`} aria-labelledby={`${prefix}-${tab}`} aria-busy={list.loading || !current} className="space-y-4">
        {current && !list.loading && !list.error && <AdminTable items={list.items} columns={columns} empty={tab === "rfqs" ? "No production RFQs submitted yet." : tab === "samples" ? "No sample requests submitted yet." : "No orders recorded yet."} />}
        {current && <Pagination list={list} />}
      </section>
    </>}
  </div>;
}
