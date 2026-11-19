import React from 'react';

export const NewShapeLogo: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div className="relative leading-none">
        <div
          className={`font-editorial tracking-wide text-[#EAB308] ${
            compact ? 'text-xs -mb-1' : 'text-sm -mb-1.5'
          }`}
        >
          new
        </div>
        <div
          className={`relative font-editorial font-bold tracking-tight text-[#EAB308] ${
            compact ? 'text-2xl' : 'text-4xl'
          }`}
        >
          <span>shape</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[-3%] right-[-4%] top-[55%] h-[2px] -rotate-3 bg-[#EAB308] shadow-[0_0_8px_rgba(234,179,8,0.45)]"
          />
        </div>
      </div>
    </div>
  );
};
