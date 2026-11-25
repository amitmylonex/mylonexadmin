import { useAdminRoute } from "../routes/useAdminRoute";
import { AdminAccess } from "../features/auth/AdminAccess";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { redirectToLogin, restoreAdminRoute } from "../features/auth/auth-navigation";
import { FabricLoader } from "../components/FabricLoader";
import { queryClient } from "../services/query-client";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { AdminRouteContent } from "../routes/AdminRouteContent";
import { AdminLayout } from "../components/layout/AdminLayout";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const sessionUserId = useRef<string | null>(null);
  const [route, navigate] = useAdminRoute();
  const currentView = route.view,
    selectedSupplierId = route.supplierId;
  const setCurrentView = (view: string) => navigate({ view });
  const setSelectedSupplierId = (id: string | null) =>
    navigate({ view: currentView, supplierId: id || undefined });

  useEffect(() => {
    let isMounted = true;
    const applySession = (nextSession: any) => {
      if (!isMounted) return;
      const nextUserId = nextSession?.user?.id ?? null;
      if (sessionUserId.current !== nextUserId) queryClient.clear();
      sessionUserId.current = nextUserId;
      setSession(nextSession);
      setLoading(false);
    };

    // Check stored session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (isMounted) {
          applySession(session);
        }
      })
      .catch((err) => {
        console.error("Session restore error:", err);
        if (isMounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        applySession(newSession);
      }
    });

    // Safety timeout: Never stay stuck on full-screen loading for more than 1.5s
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    queryClient.clear();
    setSession(null);
    redirectToLogin();
  };

  useEffect(() => {
    const expired = () => { setSession(null); setLoading(false); };
    window.addEventListener("admin-session-expired", expired);
    return () => window.removeEventListener("admin-session-expired", expired);
  }, []);
  useEffect(() => {
    if (loading) return;
    if (session) restoreAdminRoute();
    else redirectToLogin();
  }, [loading, session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <FabricLoader label="Verifying admin credentials..." />
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPage
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setLoading(false);
        }}
      />
    );
  }


  return (
    <AdminAccess identity={session.user.id} onSignOut={handleSignOut}>
      <AdminLayout currentView={route.supplierId&&currentView==="catalog"?"suppliers":currentView} userEmail={session.user.email} onNavigate={setCurrentView} onSignOut={handleSignOut}>
        {/* Main Content Shell with responsive container */}
        <main className="flex flex-1 flex-col min-w-0 max-w-full overflow-x-hidden">
          <div className="flex-1 min-w-0 max-w-full">
            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
              <Suspense
                fallback={<LoadingSkeleton label="Loading page" rows={6} />}
              >
                <ErrorBoundary key={JSON.stringify(route)}>{<AdminRouteContent route={route} navigate={navigate} />}</ErrorBoundary>
              </Suspense>
            </div>
          </div>

          {/* Responsive Portal Footer */}

        </main>
      </AdminLayout>
    </AdminAccess>
  );
}
