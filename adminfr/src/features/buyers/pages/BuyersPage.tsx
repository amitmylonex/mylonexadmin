import { useState, type MouseEvent } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { useAdminViewState } from "../../../hooks/useAdminViewState";
import { AdminTable, PageHeading, ListFeedback, Pagination, date } from "../../../components/tables/AdminTable";
import type { BuyerDirectoryItem } from "../../../contracts/buyer-contracts";

export function BuyersPage({ onSelectBuyer }: { onSelectBuyer?: (id: string) => void }) {
  const [from, setFrom] = useAdminViewState("buyers:from", ""), [to, setTo] = useAdminViewState("buyers:to", ""), [size, setSize] = useAdminViewState("buyers:page-size", "25");
  const invalidRange = Boolean(from && to && from > to);
  const list = useAdminList<BuyerDirectoryItem>("/api/v1/admin/buyers", "buyers", { from, to, pageSize: size }, { enabled: !invalidRange });
  const follow = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!onSelectBuyer || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onSelectBuyer(id);
  };
  return <div className="space-y-6">
    <PageHeading title="Buyers" description="Buyer accounts, business profiles and sourcing activity." />
    <section aria-label="Buyer directory filters" className="card p-4 flex flex-wrap items-end gap-4">
      <label className="text-xs flex-1 min-w-[200px]">Search buyers<input className="input mt-1 w-full" type="search" maxLength={150} value={list.search} placeholder="Name, email, company or city" onChange={event => list.setSearch(event.target.value)} /></label>
      <label className="text-xs">Sort<select className="input mt-1 block" value={list.sort} onChange={event => list.setSort(event.target.value)}>
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option>
      </select></label>
      <label className="text-xs">Joined from<input type="date" className="input mt-1 block" value={from} onChange={event => { setFrom(event.target.value); list.setPage(1); }} /></label>
      <label className="text-xs">Joined through<input type="date" className="input mt-1 block" value={to} onChange={event => { setTo(event.target.value); list.setPage(1); }} /></label>
      <button className="btn-outline" disabled={list.loading || invalidRange} onClick={list.reload}>Refresh</button>
    </section>
    <p className="text-xs text-muted">Joined dates include the full day in India Standard Time.</p>
    {invalidRange ? <p role="alert" className="text-sm text-rose-700">End date must follow start date.</p> : <>
      <ListFeedback list={list} />
      {!list.loading && !list.error && <AdminTable compact items={list.items} empty="No buyers found. Try another search or date range." columns={[
        { label: "Buyer Name", render: buyer => <><a className="font-semibold text-primary hover:underline" href={`/admin/buyers/${buyer.id}`} onClick={event => follow(event, buyer.id)}>{buyer.fullName || "Name not provided"}</a><p className="text-xs text-muted mt-1">{buyer.email}</p></> },
        { label: "Company", render: buyer => buyer.company || "—" },
        { label: "Contact Phone", render: buyer => buyer.phone || "—" },
        { label: "City", render: buyer => buyer.city || "—" },
        { label: "GST Number", render: buyer => buyer.gstNumber || "—" },
        { label: "Total RFQs", render: buyer => buyer.totalRfqs ?? buyer.rfqCount ?? 0 },
        { label: "Total Inquiries", render: buyer => buyer.totalInquiries ?? buyer.inquiryCount ?? 0 },
        { label: "Joined Date", render: buyer => date(buyer.createdAt) },
        { label: "Actions", render: buyer => <a className="text-primary whitespace-nowrap hover:underline" href={`/admin/buyers/${buyer.id}`} onClick={event => follow(event, buyer.id)}>View Profile</a> },
      ]} />}
      <div className="flex flex-wrap gap-4 items-center"><label className="text-xs text-muted">Rows per page<select className="input ml-2" value={size} onChange={event => { setSize(event.target.value); list.setPage(1); }}>{[10, 25, 50].map(value => <option key={value}>{value}</option>)}</select></label><div className="flex-1 min-w-[250px]"><Pagination list={list} /></div></div>
    </>}
  </div>;
}
