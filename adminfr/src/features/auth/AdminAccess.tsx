import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";
export function AdminAccess({ identity, children, onSignOut }: { identity: string; children: ReactNode; onSignOut: () => void }) {
  const verification = useQuery({ queryKey: ["admin-access", identity], queryFn: () => apiRequest("/api/v1/admin/auth/me"), retry: false });
  const error = verification.error as (Error & { status?: number }) | null;
  const state = error ? error.status === 401 || error.status === 403 ? "denied" : "error" : verification.isPending ? "loading" : "allowed";
  if (state === "allowed") return <>{children}</>;
  return <main className="mx-auto max-w-xl p-10 space-y-5">
    <h1 className="text-xl font-semibold">{state === "loading" ? "Verifying Admin access…" : state === "denied" ? "Admin access required" : "Could not verify your session"}</h1>
    <p className="text-sm text-muted">{state === "denied" ? "This account does not have an active Admin session." : state === "error" ? error?.message || "Session verification is temporarily unavailable. Please retry shortly." : "The API verifies your current account role before opening the console."}</p>
    {state !== "loading" && <><button className="btn-outline" disabled={verification.isFetching} onClick={() => { void verification.refetch(); }}>Retry</button><button className="btn-ghost ml-2" onClick={onSignOut}>Sign out</button></>}
  </main>;
}
