'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
} from '@/components/ui';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { switchWorkspace, useCreateWorkspace, useWorkspaces } from '@/lib/api/workspaces';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/shared';
import { useTenantName } from '@/store/session-store';

/**
 * The organisation switcher in the header.
 *
 * One person can belong to several organisations (one account per tenant under
 * the same verified email). Picking one moves the session there and reloads;
 * admins can also start a new organisation, which they become the admin of.
 */
export function WorkspaceSwitcher(): React.JSX.Element | null {
  const tenantName = useTenantName();
  const { data: workspaces } = useWorkspaces();
  const canCreate = useHasPermission(PERMISSIONS.TENANT_CREATE);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent): void => {
      if (!(e.target as HTMLElement).closest('[data-workspace-menu]')) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (!tenantName) return null;

  const pick = async (tenantId: string, current: boolean): Promise<void> => {
    if (current) {
      setOpen(false);
      return;
    }
    setError(null);
    setSwitchingTo(tenantId);
    try {
      await switchWorkspace(tenantId);
    } catch (err) {
      setSwitchingTo(null);
      setError(err instanceof Error ? err.message : 'Could not switch organisation');
    }
  };

  const list = workspaces ?? [];

  return (
    <div className="relative" data-workspace-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Organisation: ${tenantName}`}
        onClick={() => setOpen((v) => !v)}
        className="border-line bg-panel text-text hover:bg-canvas duration-hover flex max-w-[11rem] items-center gap-2 rounded-md border px-2.5 py-1.5 text-body-sm font-medium transition-colors sm:max-w-[16rem]"
      >
        <span className="truncate">{tenantName}</span>
        <ChevronsUpDown className="text-muted h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="border-line bg-panel absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border shadow-lg"
        >
          <p className="text-faint px-3 pb-1 pt-2.5 text-micro font-semibold uppercase tracking-wide">
            Organisations
          </p>
          <div className="max-h-72 overflow-y-auto pb-1">
            {list.length === 0 ? (
              <p className="text-muted px-3 py-2 text-body-sm">Loading…</p>
            ) : (
              list.map((w) => (
                <button
                  key={w.tenantId}
                  type="button"
                  role="menuitem"
                  disabled={switchingTo !== null}
                  onClick={() => void pick(w.tenantId, w.current)}
                  className="text-text hover:bg-canvas flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {switchingTo === w.tenantId ? (
                    <Loader2 className="text-muted h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : w.current ? (
                    <Check className="text-accent h-4 w-4 shrink-0" aria-label="Current" />
                  ) : null}
                </button>
              ))
            )}
          </div>
          {error ? <p className="text-danger px-3 pb-2 text-caption">{error}</p> : null}
          {canCreate ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className="border-line text-accent hover:bg-canvas flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-body-sm font-medium"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New organisation
            </button>
          ) : null}
        </div>
      ) : null}

      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const create = useCreateWorkspace();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setError(null);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    try {
      const ws = await create.mutateAsync(name.trim());
      setSwitching(true);
      await switchWorkspace(ws.tenantId);
    } catch (err) {
      setSwitching(false);
      setError(err instanceof Error ? err.message : 'Could not create organisation');
    }
  };

  const busy = create.isPending || switching;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogTitle>New organisation</DialogTitle>
        <DialogDescription>
          A separate workspace with its own vendors, purchase orders and team. You will be its
          admin and can switch between organisations from the header.
        </DialogDescription>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 flex flex-col gap-4">
          <Field label="Organisation name" htmlFor="new-org-name" required error={error}>
            <Input
              id="new-org-name"
              autoFocus
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Industries Pvt Ltd"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || name.trim().length < 2}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {switching ? 'Opening…' : 'Create organisation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
