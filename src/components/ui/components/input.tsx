'use client';

import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Form controls.
 *
 * One visual definition, shared by <Input>, <Select>, <DateInput>, <Textarea>
 * and <Combobox>: hairline border, 5px radius, 9px/10px padding, inherited
 * font, accent border on focus. Native `<select>` and `<input type="date">`
 * ship with browser chrome that is a different height, a different radius and
 * a different font on every OS — three controls in one row that do not line up
 * is the clearest tell of an unfinished form.
 *
 * The global fallback in styles.css gives raw `<select>`/`<input type=date>`
 * the same treatment, so a screen not yet migrated does not look broken. These
 * components are still the ones to reach for: they also carry the label,
 * hint and error wiring, which raw elements do not.
 */
/**
 * The one control class string.
 *
 * Exported because several screens style raw `<input>` / `<select>` elements
 * inline through a local `inputCls` constant. Six of those existed and all six
 * disagreed — different radii, different padding, one focusing on a ring and
 * another on a border — so two fields in the same form did not match. They now
 * all point here.
 */
export const controlClass = [
  'w-full rounded-sm border border-line bg-panel px-2.5 py-[9px] text-body-sm text-text',
  'placeholder:text-faint focus:border-accent focus:outline-none focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-55',
  'aria-[invalid=true]:border-danger',
].join(' ');

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input ref={ref} type={type} className={cn(controlClass, className)} {...props} />
  ),
);
Input.displayName = 'Input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlClass, 'min-h-[72px]', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

/**
 * Styled native select. The chevron is drawn by us so it is the same glyph in
 * the same colour on every platform; `appearance-none` removes the OS one.
 *
 * Above roughly ten options reach for <Combobox> instead — a native select
 * with 200 vendors in it is a scrolling wall with no way to type.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        controlClass,
        'appearance-none bg-no-repeat pr-8',
        "bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7078' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        'bg-[position:right_9px_center]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

/**
 * Date field. Wraps the native picker (which is genuinely good on every
 * platform now) but normalises the box it sits in, and the value is always an
 * ISO `yyyy-mm-dd` string regardless of what the OS displays — see
 * lib/format.ts → `formatDate` for the single display format.
 */
export type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="date"
      className={cn(controlClass, 'min-h-[38px]', className)}
      {...props}
    />
  ),
);
DateInput.displayName = 'DateInput';

/**
 * Label + control + hint/error, laid out once.
 *
 * `error` replaces the hint rather than stacking under it — two lines of
 * helper text under a rejected field is where people stop reading.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-text text-caption font-medium">
        {label}
        {required ? <span className="text-danger ml-0.5">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-danger text-caption">{error}</p>
      ) : hint ? (
        <p className="text-muted text-caption">{hint}</p>
      ) : null}
    </div>
  );
}

// ── Combobox ────────────────────────────────────────────────────────────────

export interface ComboboxOption {
  value: string;
  label: string;
  /** Second line in the list — vendor code, cost-centre owner, GSTIN. */
  detail?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Shown above the list when the search returns nothing. */
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
}

/**
 * Searchable single-select.
 *
 * Required for any vendor, item, cost-centre or plant selector — anywhere the
 * option count is unbounded or above roughly ten. A native `<select>` there
 * forces the user to know the exact name and to scroll for it; this one filters
 * on label *and* detail, so "MSME" or a vendor code finds the row too.
 *
 * Keyboard: ↑/↓ move, Enter selects, Escape closes, Tab commits and leaves.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyText = 'No matches',
  disabled,
  id,
  className,
  'aria-invalid': ariaInvalid,
}: ComboboxProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  // The listbox needs a stable id so `aria-controls` can point at it; useId
  // keeps it unique when several comboboxes share a form.
  const listId = React.useId();

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.detail ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  // Close on outside pointerdown and on Escape, so it behaves like a menu
  // rather than a panel you have to click the trigger again to dismiss.
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const commit = (opt: ComboboxOption): void => {
    if (opt.disabled) return;
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => {
        const next = e.key === 'ArrowDown' ? h + 1 : h - 1;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) commit(opt);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        disabled={disabled}
        className={cn(controlClass, 'pr-8')}
        value={open ? query : (selected?.label ?? '')}
        placeholder={selected ? selected.label : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <span
        aria-hidden
        className="text-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-micro"
      >
        ▾
      </span>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="border-line bg-panel absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border py-1 shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="text-muted px-2.5 py-2 text-caption">{emptyText}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onPointerDown={(e) => {
                  e.preventDefault();
                  commit(o);
                }}
                onPointerEnter={() => setHighlight(i)}
                className={cn(
                  'cursor-pointer px-2.5 py-1.5 text-body-sm',
                  i === highlight ? 'bg-accent-wash text-accent' : 'text-text',
                  o.disabled && 'cursor-not-allowed opacity-50',
                  o.value === value && i !== highlight && 'font-medium',
                )}
              >
                {o.label}
                {o.detail ? (
                  <span className="text-muted ml-1.5 text-micro">{o.detail}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
