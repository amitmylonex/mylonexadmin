import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useDebouncedValue } from "./useDebouncedValue";
export function useAdminList<T = any>(
  path: string,
  itemKey: string,
  extra: Record<string, string> = {},
  settings: { enabled?: boolean } = {},
) {
  const [search, setSearchState] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatusState] = useState(""),
    [sort, setSortState] = useState("newest"),
    [revision, setRevision] = useState(0);
  const [items, setItems] = useState<T[]>([]),
    [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const term = useDebouncedValue(search);
  const extraKey = JSON.stringify(extra);
  useEffect(() => {
    if (settings.enabled === false) { setLoading(false); return; }
    const controller = new AbortController();
    const query = new URLSearchParams({
      search: term,
      page: String(page),
      pageSize: "25",
      sort,
      ...JSON.parse(extraKey),
    });
    if (path.includes("rfq-tracking")) query.set("q", term);
    if (status) query.set("status", status);
    setLoading(true);
    setError("");
    apiRequest<any>(path + "?" + query, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setItems(result[itemKey] || []);
          if (page > Math.max(1, Number(result.totalPages) || 1)) setPage(Math.max(1, Number(result.totalPages) || 1));
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e.status === 403
              ? "Admin permission is required to view this page."
              : e.message,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, itemKey, term, page, status, sort, extraKey, revision, settings.enabled]);
  return {
    items,
    data,
    loading,
    error,
    search,
    setSearch: (value: string) => {
      setSearchState(value);
      setPage(1);
    },
    status,
    setStatus: (value: string) => {
      setStatusState(value);
      setPage(1);
    },
    sort,
    setSort: (value: string) => {
      setSortState(value);
      setPage(1);
    },
    page,
    setPage,
    totalPages: data?.totalPages || 1,
    totalCount: data?.totalCount || 0,
    reload: () => setRevision((r) => r + 1),
  };
}
