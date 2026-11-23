import { useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "../../lib/api";
type Status = "loading" | "allowed" | "denied" | "error";
export function AdminAccess({ identity, children, onSignOut }: { identity: string; children: ReactNode; onSignOut: () => void }) {
  const [verification, setVerification] = useState<{ identity: string; status: Status; message?: string }>({ identity, status: "loading" });
  const [retry, setRetry] = useState(0);
  const state = verification.identity === identity ? verification.status : "loading";
  useEffect(() => {
    let cancelled = false;
    setVerification({ identity, status: "loading" });
    apiRequest("/api/v1/admin/auth/me").then(() => {
      if (!cancelled) setVerification({ identity, status: "allowed" });
    }).catch(error => {
      if (!cancelled) setVerification({ identity, status: error.status === 401 || error.status === 403 ? "denied" : "error", message: error.message });
    });
    return () => { cancelled = true; };
  }, [identity, retry]);
  if (state === "allowed") return <>{children}</>;
  return <main className="mx-auto max-w-xl p-10 space-y-5">
    <h1 className="text-xl font-semibold">{state === "loading" ? "Verifying Admin access…" : state === "denied" ? "Admin access required" : "Could not verify your session"}</h1>
    <p className="text-sm text-muted">{state === "denied" ? "This account does not have an active Admin session." : state === "error" ? verification.message || "Session verification is temporarily unavailable. Please retry shortly." : "The API verifies your current account role before opening the console."}</p>
    {state !== "loading" && <><button className="btn-outline" onClick={() => setRetry(r => r + 1)}>Retry</button><button className="btn-ghost ml-2" onClick={onSignOut}>Sign out</button></>}
  </main>;
}
