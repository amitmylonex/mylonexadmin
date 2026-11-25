import React, { useState, useEffect, useRef } from "react";
import {navigationForRole} from "../../routes/admin-navigation";
import {useAdminViewState} from "../../hooks/useAdminViewState";
import { routePath } from "../../routes/useAdminRoute";
import {MobileNavigationDrawer} from "./MobileNavigationDrawer";
import { Logo } from "./Logo";
import { ConfirmSignOutModal } from "./ConfirmSignOutModal";
import { Menu, X } from "lucide-react";

interface SidebarProps {
  currentView: string;
  userEmail: string;
  onNavigate: (view: string) => void;
  onSignOut: () => Promise<void>;
}

export function Sidebar({
  currentView,
  userEmail,
  onNavigate,
  onSignOut,
}: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (!media.matches && !isMobileMenuOpen) drawerRef.current?.setAttribute("inert", "");
      else drawerRef.current?.removeAttribute("inert");
    };
    update(); media.addEventListener("change", update);
    if (isMobileMenuOpen && !media.matches) drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (!isMobileMenuOpen || media.matches) return;
      if (event.key === "Escape") { setIsMobileMenuOpen(false); toggleRef.current?.focus(); }
      if (event.key === "Tab") {
        const nodes = drawerRef.current?.querySelectorAll<HTMLElement>("a[href],button");
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => { media.removeEventListener("change", update); window.removeEventListener("keydown", keyboard); };
  }, [isMobileMenuOpen]);

  const navItems = navigationForRole("ADMIN");
  const [collapsed,setCollapsed] = useAdminViewState("sidebar:collapsed",false);

  return (
    <>
      {/* Mobile Top Navbar (Visible only on < lg screens) */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-secondary text-white border-b border-white/10 sticky top-0 z-30 shadow-md">
        <Logo compact />
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-white/60 truncate max-w-[140px] sm:max-w-[200px]">
            {userEmail}
          </span>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl hover:bg-white/10 transition text-white"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="admin-sidebar"
            ref={toggleRef}
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <MobileNavigationDrawer open={isMobileMenuOpen} onClose={()=>setIsMobileMenuOpen(false)}>
      {/* Main Sidebar (Drawer on mobile, Sticky sidebar on desktop) */}
      <aside
        id="admin-sidebar"
        ref={drawerRef}
        aria-label="Admin navigation"
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 ${collapsed ? "lg:w-20" : "lg:w-72"} bg-secondary text-white border-r border-white/10 flex flex-col shrink-0 transition-transform duration-200 ease-in-out ${
          isMobileMenuOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 lg:p-6 flex items-center justify-between">
          <div className={collapsed ? "lg:hidden" : ""}>
            <p className="label text-white/60">MyloNex</p>
            <h2 className="text-xl font-semibold">Admin Console</h2>
            <p className="mt-1 text-sm text-white/60">{userEmail}</p>
          </div>
          <button
            type="button"
            className="lg:hidden p-2"
            aria-label="Close navigation"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <button className="hidden lg:flex mx-4 mb-3 rounded-lg p-2 text-xs hover:bg-white/10" aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!collapsed} onClick={()=>setCollapsed(value=>!value)}>{collapsed?"→":"← Collapse"}</button>
        {/* Navigation Items */}
        <nav className="space-y-2 px-4 pb-6 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = currentView === item.id;

            return (
              <a
                title={collapsed?item.label:undefined}
                key={item.id}
                href={routePath({ view: item.id })}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onNavigate(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition text-left ${
                  active
                    ? "bg-white/20 text-white shadow-sm font-semibold"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className={collapsed ? "lg:sr-only" : ""}>{item.label}</span>{collapsed && <span aria-hidden="true" className="hidden lg:inline font-bold" title={item.label}>{item.label.split(" ").map(word=>word[0]).join("").slice(0,3)}</span>}
                <span
                  className={`text-xs ${active ? "text-white font-bold" : "text-white/40"}`}
                >
                  →
                </span>
              </a>
            );
          })}

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setShowSignOutConfirm(true);
            }}
            className="w-full mt-4 flex items-center justify-between rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-red-200 hover:bg-red-500/20 transition text-left"
          >
            <span>Sign out</span>
            <span className="text-xs text-red-200/70">→</span>
          </button>
        </nav>
      </aside>
      </MobileNavigationDrawer>

      {/* Confirm Sign Out Popup */}
      <ConfirmSignOutModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={onSignOut}
      />
    </>
  );
}
