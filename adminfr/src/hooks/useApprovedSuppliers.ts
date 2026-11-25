import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { useDebouncedValue } from "./useDebouncedValue";

type SupplierOption = { id: string; companyName: string; status?: string; isActive?: boolean; user?: {email?: string; fullName?: string | null}; _count?: {supplierCatalogEntries?: number; wovenProducts?: number; capabilities?: number} };
export function useApprovedSuppliers(search: string, enabled = true, explainEmpty = false, unmatchedForRfq?: string) {
  const term = useDebouncedValue(search);
  const url = "/api/v1/admin/suppliers?status=APPROVED&pageSize=25&search=" + encodeURIComponent(term) + (unmatchedForRfq ? "&unmatchedForRfq=" + encodeURIComponent(unmatchedForRfq) : "");
  const query = useQuery({ queryKey: ["admin", url], queryFn: ({ signal }) => apiRequest<{ suppliers: SupplierOption[]; totalCount?: number }>(url, { signal }), enabled });
  // Pending suppliers are informational only; never offer them as eligible routes.
  // Query them only when the RFQ picker needs to explain an empty approved list.
  const showPending = enabled && explainEmpty && query.data?.suppliers?.length === 0;
  const pendingUrl = url.replace("status=APPROVED", "status=PENDING");
  const pending = useQuery({ queryKey: ["admin", pendingUrl], queryFn: ({ signal }) => apiRequest<{ suppliers: SupplierOption[]; totalCount?: number }>(pendingUrl, { signal }), enabled: showPending });
  return {
    suppliers: query.data?.suppliers || [],
    pendingSuppliers: showPending ? pending.data?.suppliers || [] : [],
    pendingCount: showPending ? pending.data?.totalCount ?? pending.data?.suppliers?.length ?? 0 : 0,
    error: query.error || (showPending ? pending.error : null),
    loading: query.isPending && query.isFetching || showPending && pending.isPending && pending.isFetching,
    searching: search !== term,
    reload: () => { void query.refetch({ cancelRefetch: false }); if (showPending) void pending.refetch({ cancelRefetch: false }); },
  };
}
