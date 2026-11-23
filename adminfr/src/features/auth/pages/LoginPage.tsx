import React, { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { apiRequest } from "../../../lib/api";
import { Logo } from "../../../components/layout/Logo";
import { Lock, Mail, AlertCircle, ShieldCheck, Loader2 } from "lucide-react";

export function LoginPage({
  onLoginSuccess,
}: {
  onLoginSuccess: (session: any) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        // Fast role verification against Fastify backend to ensure account has ADMIN role
        try {
          await apiRequest("/api/v1/admin/auth/me");
        } catch (failure: any) {
          if (failure.status === 401 || failure.status === 403) await supabase.auth.signOut({ scope: "local" });
          setError(failure.message || "Admin access could not be verified. Check the API connection and retry.");
          setIsLoading(false);
          return;
        }

        onLoginSuccess(data.session);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4 text-ink">
      <div className="w-full max-w-md">
        <div className="card p-8 bg-surface shadow-soft border border-border">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3 bg-secondary rounded-2xl mb-3 shadow-sm inline-block">
              <Logo />
            </div>
            <p className="label mt-2">Authorized Operations</p>
            <h1 className="text-xl font-semibold text-ink mt-0.5">
              Admin Console Sign In
            </h1>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mylonex.com"
                  required
                  autoComplete="email"
                  className="input pl-10 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="label block mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input pl-10 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-2 py-3 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                "Sign In to Admin Console"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Fastify API verified · ADMIN accounts only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
