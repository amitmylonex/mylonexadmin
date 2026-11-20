import React from "react";
export type Column<T> = { label: string; render: (row: T) => React.ReactNode };
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header>
      <p className="label">Admin Console</p>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      {children}
    </header>
  );
}
export function QueryToolbar({
  list,
  statuses = [],
}: {
  list: any;
  statuses?: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="card p-4 flex flex-wrap gap-4 items-end">
      <label className="text-xs flex-1 min-w-[200px]">
        Search
        <input
          className="input mt-1"
          value={list.search}
          placeholder="Search…"
          maxLength={150}
          onChange={(e) => list.setSearch(e.target.value)}
        />
      </label>
      {statuses.length > 0 && (
        <label className="text-xs">
          Status
          <select
            className="input mt-1"
            value={list.status}
            onChange={(e) => list.setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-xs">
        Sort
        <select
          className="input mt-1"
          value={list.sort}
          onChange={(e) => list.setSort(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
      <button
        className="btn-outline"
        onClick={list.reload}
        disabled={list.loading}
      >
        Refresh
      </button>
    </div>
  );
}
export function ListFeedback({ list }: { list: any }) {
  return (
    <>
      {list.error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {list.error}
          <button className="ml-4 underline" onClick={list.reload}>
            Retry
          </button>
        </div>
      )}
      {list.loading && (
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      )}
    </>
  );
}
export function AdminTable<T extends { id: string }>({
  items,
  columns,
  empty = "No records found.",
  compact = false,
}: {
  items: T[];
  columns: Column<T>[];
  empty?: string;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white">
      <table className={`min-w-full divide-y divide-border ${compact ? "text-xs" : "text-sm"}`}>
        <thead className="bg-slate-50 text-left text-muted">
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" className={`${compact ? "px-3 py-3" : "px-5 py-4"} font-semibold`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((row) => (
            <tr key={row.id}>
              {columns.map((c, i) => (
                <td key={i} className={`${compact ? "px-3 py-3" : "px-5 py-4"} align-top`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <p className="p-10 text-center text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}
export function Pagination({ list }: { list: any }) {
  return (
    <nav
      aria-label="List pagination"
      className="flex justify-between items-center text-xs text-muted"
    >
      <span>
        {list.totalCount} records · Page {list.page} of {list.totalPages}
      </span>
      <div className="flex gap-2">
        <button
          className="btn-outline text-xs"
          disabled={list.page <= 1 || list.loading}
          onClick={() => list.setPage((p: number) => p - 1)}
        >
          Previous
        </button>
        <button
          className="btn-outline text-xs"
          disabled={list.page >= list.totalPages || list.loading}
          onClick={() => list.setPage((p: number) => p + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs whitespace-nowrap">
      {value?.replace(/_/g, " ") || "—"}
    </span>
  );
}
export const money = (value: unknown) =>
  value == null
    ? "—"
    : Number(value).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
      });
export const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("en-IN") : "—";
