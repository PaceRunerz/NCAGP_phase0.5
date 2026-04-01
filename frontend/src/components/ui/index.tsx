import * as React from 'react';
import { cn } from '@/lib/utils';

// ── Textarea ──────────────────────────────────────────────────────

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

// ── Label ─────────────────────────────────────────────────────────

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium text-slate-300 leading-none', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

// ── Select ────────────────────────────────────────────────────────

interface SelectContextValue {
  value: string;
  onValueChange: (val: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}
const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
});

export function Select({
  value, onValueChange, children,
}: {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(SelectContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500',
        className,
      )}
    >
      {children}
      <span className="ml-2 opacity-50">▾</span>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return <span>{value || placeholder}</span>;
}

export function SelectContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(SelectContext);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      <div className={cn(
        'absolute z-50 mt-1 w-full min-w-[8rem] rounded-lg border border-slate-700 bg-slate-800 shadow-lg overflow-hidden',
        className,
      )}>
        {children}
      </div>
    </>
  );
}

export function SelectItem({
  value, children, className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { onValueChange, setOpen } = React.useContext(SelectContext);
  return (
    <div
      onClick={() => { onValueChange(value); setOpen(false); }}
      className={cn(
        'relative flex cursor-pointer select-none items-center px-3 py-2 text-sm text-white hover:bg-slate-700 transition-colors',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <div className="relative group">{children}</div>;
}

export function TooltipTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  return <>{children}</>;
}

export function TooltipContent({
  children, className, side,
}: {
  children: React.ReactNode;
  className?: string;
  side?: string;
}) {
  return (
    <div
      className={cn(
        'absolute z-50 hidden group-hover:block w-max max-w-xs rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white shadow-lg',
        side === 'right' ? 'left-full top-0 ml-2' : 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── ScrollArea ────────────────────────────────────────────────────

export function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-auto', className)}>
      {children}
    </div>
  );
}
