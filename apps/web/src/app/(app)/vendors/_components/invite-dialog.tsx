'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@procureflow/ui';
import { VENDOR_CATEGORY_CONFIGS } from '@procureflow/shared';
import { useState } from 'react';

import { useInviteVendor } from '@/lib/api/vendors';
import { useToastStore } from '@/store/toast-store';

export function InviteVendorDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const [legalEntityName, setLegalEntityName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [categoryKey, setCategoryKey] = useState(
    VENDOR_CATEGORY_CONFIGS[0]?.categoryKey ?? '',
  );
  const invite = useInviteVendor();
  const toast = useToastStore((s) => s.push);

  const submit = (): void => {
    invite.mutate(
      {
        legalEntityName,
        name: name || legalEntityName,
        email,
        categoryKey,
        source: 'BUYER_INVITE_SPOT',
      },
      {
        onSuccess: () => {
          toast('Vendor invited — onboarding started', 'success');
          setLegalEntityName('');
          setName('');
          setEmail('');
          onClose();
        },
        onError: (e) => toast(e.message || 'Could not invite vendor', 'error'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Invite vendor</DialogTitle>
        <DialogDescription>
          Sends an onboarding invitation. The vendor completes the 6-step wizard, then it
          lands in the review queue.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-muted mb-1 block text-[12px] font-medium">
              Legal entity name
            </label>
            <Input
              value={legalEntityName}
              onChange={(e) => setLegalEntityName(e.target.value)}
              placeholder="Acme Industries Pvt Ltd"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-[12px] font-medium">
              Display name (optional)
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-[12px] font-medium">
              Contact email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales@acme.example"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-[12px] font-medium">
              Category
            </label>
            <select
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
              className="border-line bg-surface text-ink w-full rounded-md border px-3 py-2 text-[13px]"
            >
              {VENDOR_CATEGORY_CONFIGS.map((c) => (
                <option key={c.categoryKey} value={c.categoryKey}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={invite.isPending || !legalEntityName || !email}
          >
            {invite.isPending ? 'Inviting…' : 'Send invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
