import React from "react";

interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  const size = compact ? 36 : 42;

  return (
    <div className="flex items-center gap-3">
      <img
        src="/images/mylonex.svg"
        alt="MyloNex"
        width={size}
        height={size}
        className="shrink-0 object-contain drop-shadow-sm"
      />
      {!compact && (
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>MyloNex</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
              Admin
            </span>
          </div>
          <div className="text-[0.65rem] font-medium tracking-wide text-white/50">
            Textile Marketplace
          </div>
        </div>
      )}
    </div>
  );
}
