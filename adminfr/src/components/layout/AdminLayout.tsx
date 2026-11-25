import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { PortalFooter } from "./PortalFooter";
export function AdminLayout({children,...navigation}:{children:ReactNode;currentView:string;userEmail:string;onNavigate:(view:string)=>void;onSignOut:()=>Promise<void>}) {
  return <div className="flex min-h-screen bg-canvas flex-col lg:flex-row text-ink font-sans antialiased"><Sidebar {...navigation}/><div className="flex flex-1 min-w-0 flex-col">{children}<PortalFooter/></div></div>;
}
