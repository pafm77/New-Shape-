import React from 'react';
import { X } from 'lucide-react';

export const BrandCard: React.FC<{
  children: React.ReactNode;
  highlight?: boolean;
  className?: string;
}> = ({ children, highlight = false, className = '' }) => (
  <div
    className={`rounded-2xl bg-[#1B1B1E] p-4 sm:p-5 border transition-colors ${
      highlight ? 'border-[#EAB308]/80 shadow-[0_0_0_1px_rgba(234,179,8,0.18)]' : 'border-[#323238]'
    } ${className}`}
  >
    {children}
  </div>
);

export type PillTone = 'gold' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'neutral';

const TONE_MAP: Record<PillTone, string> = {
  gold: 'bg-[#3D3314] text-[#FACC15] border-[#EAB308]/40',
  green: 'bg-[#143521] text-[#22C55E] border-[#22C55E]/40',
  amber: 'bg-[#3B2A10] text-[#F59E0B] border-[#F59E0B]/40',
  red: 'bg-[#3B1518] text-[#EF4444] border-[#EF4444]/40',
  blue: 'bg-[#102A3A] text-[#38BDF8] border-[#38BDF8]/40',
  purple: 'bg-[#2E1065] text-[#D8B4FE] border-[#A855F7]/50',
  neutral: 'bg-[#242429] text-[#A1A1AA] border-[#323238]',
};

export const StatusPill: React.FC<{
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
}> = ({ children, tone = 'neutral', className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_MAP[tone]} ${className}`}
  >
    {children}
  </span>
);

export const GoldButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { fullWidth?: boolean }
> = ({ children, fullWidth = false, className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#EAB308] px-4 py-2.5 text-sm font-bold text-[#121214] transition hover:bg-[#FACC15] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 ${
      fullWidth ? 'w-full' : ''
    } ${className}`}
  >
    {children}
  </button>
);

export const SecondaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { fullWidth?: boolean }
> = ({ children, fullWidth = false, className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#323238] bg-[#242429] px-4 py-2.5 text-sm font-semibold text-[#F4F4F5] transition hover:border-[#EAB308]/60 hover:bg-[#2B2B31] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 ${
      fullWidth ? 'w-full' : ''
    } ${className}`}
  >
    {children}
  </button>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#323238] bg-[#1B1B1E]/60 px-6 py-10 text-center">
    <div className="mb-3 rounded-2xl bg-[#242429] p-3 text-[#EAB308]">{icon}</div>
    <h3 className="text-base font-bold text-[#F4F4F5]">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-[#A1A1AA]">{subtitle}</p>
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}> = ({ open, title, subtitle, onClose, children, maxWidthClass = 'max-w-lg' }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#323238] bg-[#1B1B1E] p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#323238] pb-3">
          <div>
            <h3 className="text-lg font-bold text-[#F4F4F5]">{title}</h3>
            {subtitle && <p className="text-xs text-[#EAB308]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1.5 block text-xs font-semibold text-[#A1A1AA]">{children}</label>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm text-[#F4F4F5] placeholder-[#71717A] outline-none transition focus:border-[#EAB308] ${className}`}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => (
  <textarea
    {...props}
    className={`w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm text-[#F4F4F5] placeholder-[#71717A] outline-none transition focus:border-[#EAB308] ${className}`}
  />
);
