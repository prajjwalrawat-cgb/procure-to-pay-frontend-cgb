'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  cn,
  controlClass,
} from '@/components/ui';
import { Check, ChevronDown, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ASSIGNABLE_ROLES, roleLabel } from '@/lib/api/users';

/** Selected roles, in the canonical order of ASSIGNABLE_ROLES. */
function ordered(roles: string[]): string[] {
  return ASSIGNABLE_ROLES.map((r) => r.value).filter((v) => roles.includes(v));
}

export function rolesSummary(roles: string[]): string {
  return ordered(roles).map(roleLabel).join(', ') || '—';
}

/**
 * Checkbox list of every assignable role. A person often needs more than one —
 * a Requester who is also a Procurement Officer raises PRs and turns them into
 * POs — so roles are picked as a set, never one at a time.
 */
export function RoleCheckboxList({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
}): React.JSX.Element {
  const toggle = (role: string): void => {
    onChange(
      value.includes(role) ? value.filter((r) => r !== role) : ordered([...value, role]),
    );
  };

  return (
    <div className="border-line divide-line max-h-72 divide-y overflow-y-auto rounded-md border">
      {ASSIGNABLE_ROLES.map((r) => {
        const checked = value.includes(r.value);
        return (
          <label
            key={r.value}
            className={cn(
              'hover:bg-canvas flex cursor-pointer items-start gap-2.5 px-3 py-2',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            <input
              type="checkbox"
              className="accent-accent mt-0.5 h-4 w-4 shrink-0"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(r.value)}
            />
            <span className="min-w-0">
              <span className="text-text block text-body-sm font-medium">{r.label}</span>
              <span className="text-muted block text-caption">{r.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Invite form: a field that shows the chosen roles and expands into the list. */
export function InviteRolePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (roles: string[]) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        id={id}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(controlClass, 'flex items-center gap-2 text-left')}
      >
        <span className={cn('min-w-0 flex-1 truncate', value.length === 0 && 'text-muted')}>
          {value.length === 0 ? 'Choose one or more roles' : rolesSummary(value)}
        </span>
        <ChevronDown
          className={cn('text-muted h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? <RoleCheckboxList value={value} onChange={onChange} /> : null}
    </div>
  );
}

/** Team table: the member's roles as a button that opens an editor dialog. */
export function MemberRolesEditor({
  memberName,
  roles,
  saving,
  onSave,
}: {
  memberName: string;
  roles: string[];
  saving: boolean;
  onSave: (roles: string[], done: () => void) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(roles);

  useEffect(() => {
    if (open) setDraft(ordered(roles));
  }, [open, roles]);

  const unchanged =
    draft.length === roles.length && draft.every((r) => roles.includes(r));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit roles for ${memberName}`}
        className={cn(
          controlClass,
          'flex w-auto min-w-44 max-w-72 items-center gap-2 py-1.5 text-left text-caption',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{rolesSummary(roles)}</span>
        <Pencil className="text-muted h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Roles for {memberName}</DialogTitle>
          <DialogDescription>
            Pick every role this person needs. Their access is the combination of all of
            them.
          </DialogDescription>
          <div className="mt-4">
            <RoleCheckboxList value={draft} onChange={setDraft} disabled={saving} />
          </div>
          {draft.length === 0 ? (
            <p className="text-danger mt-2 text-caption">Choose at least one role.</p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={saving || draft.length === 0 || unchanged}
              onClick={() => onSave(draft, () => setOpen(false))}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {saving ? 'Saving…' : 'Save roles'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
