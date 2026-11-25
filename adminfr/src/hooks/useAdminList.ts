import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAdminViewState } from "./useAdminViewState";
import { apiRequest } from "../lib/api";
import { useDebouncedValue } from "./useDebouncedValue";
const EMPTY_ITEMS: never[] = [];
export function useAdminList<T = any>(
  path: string,
  itemKey: string,
  extra: Record<string, string> = {},
  settings: { enabled?: boolean } = {},
) {
  const [view, setView] = useAdminViewState(path, { search: "", page: 1, status: "", sort: "newest" });
  const { search, page, status, sort } = view;
  const setPage = (next: number | ((previous: number) => number)) => setView(previous => ({
    ...previous, page: typeof next === "function" ? next(previous.page) : next,
  }));
  const term = useDebouncedValue(search);
  const params = new URLSearchParams({ search: term, page: String(page), pageSize: "25", sort, ...extra });
  if (path.includes("rfq-tracking")) params.set("q", term);
  if (status) params.set("status", status);
  const url = path + "?" + params;
  const result = useQuery({ queryKey: ["admin", url], queryFn: () => apiRequest<any>(url), enabled: settings.enabled !== false });
  const data = result.data;
  const totalPages = Math.max(1, Number(data?.totalPages) || 1);
  useEffect(() => { if (data && page > totalPages) setPage(totalPages); }, [data, page, totalPages]);
  const items: T[] = data?.[itemKey] || EMPTY_ITEMS;
  const loading = settings.enabled !== false && result.isPending && result.isFetching;
  const error = result.error ? (result.error as any).status === 403 ? "Admin permission is required to view this page." : result.error.message : "";
  return {
    items,
    data,
    loading,
    refreshing: result.isFetching && !loading,
    error: data === undefined ? error : "",
    refreshError: data !== undefined ? error : "",
    search,
    setSearch: (value: string) => {
      setView(previous => ({ ...previous, search: value, page: 1 }));
    },
    status,
    setStatus: (value: string) => {
      setView(previous => ({ ...previous, status: value, page: 1 }));
    },
    sort,
    setSort: (value: string) => {
      setView(previous => ({ ...previous, sort: value, page: 1 }));
    },
    page,
    setPage,
    totalPages: data?.totalPages || 1,
    totalCount: data?.totalCount || 0,
    reload: () => { void result.refetch({ cancelRefetch: false }); },
  };
}
