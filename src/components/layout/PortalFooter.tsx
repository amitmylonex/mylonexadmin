import React from "react";

export function PortalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Admin Portal
            </p>
            <p className="mt-0.5 text-sm font-medium text-ink/80">
              Secure textile sourcing and operations on MyloNex.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-muted">
            <span className="hover:text-primary transition cursor-pointer">
              Terms
            </span>
            <span className="hover:text-primary transition cursor-pointer">
              Privacy
            </span>
            <a
              href="mailto:hello@mylonex.com"
              className="hover:text-primary transition"
            >
              hello@mylonex.com
            </a>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} MyloNex. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
