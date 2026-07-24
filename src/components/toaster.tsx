'use client';

import { cn } from '@/components/ui';

import { useToastStore } from '@/store/toast-store';

/** Minimal toast surface, mounted once in Providers. */
export function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useToastStore();
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'rounded-sm px-3.5 py-2.5 text-left text-[13px] font-medium text-white shadow-lg',
            t.variant === 'success' && 'bg-accent',
            t.variant === 'error' && 'bg-danger',
            t.variant === 'info' && 'bg-ink',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
