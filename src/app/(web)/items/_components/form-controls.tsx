'use client';

/**
 * Local form primitives for the item master. They differ from the inventory
 * module's controls in one way that matters here: every input can render an
 * inline error, so a 422 from `POST /items` lands on the field that caused it
 * instead of only in a toast.
 */

import { controlClass } from '@/components/ui';

// The shared control definition — see components/ui/components/input.tsx.
const INPUT_CLASS = controlClass;
const ERROR_CLASS = 'border-danger focus:border-danger';

export function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-caption font-medium text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="text-caption text-danger">{error}</span>
      ) : hint ? (
        <span className="text-caption text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput({
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
}): React.JSX.Element {
  return <input {...props} className={`${INPUT_CLASS} ${invalid ? ERROR_CLASS : ''}`} />;
}

export function SelectInput({
  invalid,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
}): React.JSX.Element {
  // pr-8 clears the chevron the global select style draws on the right.
  return (
    <select {...props} className={`${INPUT_CLASS} pr-8 ${invalid ? ERROR_CLASS : ''}`} />
  );
}

export function TextArea({
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
}): React.JSX.Element {
  return (
    <textarea
      rows={2}
      {...props}
      className={`${INPUT_CLASS} ${invalid ? ERROR_CLASS : ''}`}
    />
  );
}
