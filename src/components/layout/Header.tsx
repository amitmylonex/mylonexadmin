import React, { useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { ConfirmSignOutModal } from "./ConfirmSignOutModal";

interface HeaderProps {
  userEmail: string;
  onSignOut: () => Promise<void>;
}

export function Header({ userEmail, onSignOut }: HeaderProps) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-semibold text-slate-800">
            Admin Management Console
          </h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 pr-3 sm:pr-4 border-r border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 leading-none">
                Admin Operator
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[160px]">
                {userEmail}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <ConfirmSignOutModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={onSignOut}
      />
    </>
  );
}
