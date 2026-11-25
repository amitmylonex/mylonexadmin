import type {ReactNode} from "react";
export function MobileNavigationDrawer({open,onClose,children}:{open:boolean;onClose:()=>void;children:ReactNode}) {
  return <>{open&&<div aria-hidden="true" onClick={onClose} className="lg:hidden fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm"/>}{children}</>;
}
