'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/components/ui';
import { SUSPENSION_REASON_CODE, SUSPENSION_TYPE } from '@/lib/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useBlacklistVendor, useSuspendVendor } from '@/lib/api/vendors';
import { useToastStore } from '@/store/toast-store';

export default function SuspendVendorPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);

  const [mode, setMode] = useState<'suspend' | 'blacklist'>('suspend');
  const [suspensionType, setSuspensionType] =
    useState<(typeof SUSPENSION_TYPE)[number]>('TEMPORARY');
  const [reasonCode, setReasonCode] =
    useState<(typeof SUSPENSION_REASON_CODE)[number]>('QUALITY_ISSUE');
  const [reasonNotes, setReasonNotes] = useState('');
  const [cosignerId, setCosignerId] = useState('');

  const suspend = useSuspendVendor(params.id);
  const blacklist = useBlacklistVendor(params.id);

  const submit = (): void => {
    if (!reasonNotes.trim()) {
      toast('A reason is required', 'error');
      return;
    }
    if (mode === 'suspend') {
      suspend.mutate(
        { suspensionType, reasonCode, reasonNotes },
        {
          onSuccess: () => {
            toast('Vendor suspended', 'success');
            router.push(`/vendors/${params.id}`);
          },
          onError: (e) => toast(e.message, 'error'),
        },
      );
    } else {
      blacklist.mutate(
        { reasonNotes, cosignerId: cosignerId || undefined },
        {
          onSuccess: () => {
            toast('Vendor blacklisted', 'success');
            router.push(`/vendors/${params.id}`);
          },
          onError: (e) => toast(e.message, 'error'),
        },
      );
    }
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4">
        <Link
          href={`/vendors/${params.id}`}
          className="text-muted hover:text-ink text-[12px]"
        >
          ← Vendor
        </Link>
        <PageHeader
          title="Suspend or blacklist"
          description="Vendors are never deleted. Suspension blocks new POs but existing POs continue; a blacklist is terminal and requires a Legal Officer co-sign."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex gap-1">
              <button
                onClick={() => setMode('suspend')}
                className={`rounded-md px-3 py-1 text-[13px] ${mode === 'suspend' ? 'bg-ink text-white' : 'text-muted'}`}
              >
                Suspend
              </button>
              <button
                onClick={() => setMode('blacklist')}
                className={`rounded-md px-3 py-1 text-[13px] ${mode === 'blacklist' ? 'bg-danger text-white' : 'text-muted'}`}
              >
                Blacklist
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === 'suspend' && (
            <>
              <div>
                <label className="text-muted mb-1 block text-[12px] font-medium">
                  Type
                </label>
                <select
                  value={suspensionType}
                  onChange={(e) =>
                    setSuspensionType(e.target.value as (typeof SUSPENSION_TYPE)[number])
                  }
                  className="border-line bg-panel text-ink w-full rounded-md border px-3 py-2 text-[13px]"
                >
                  {SUSPENSION_TYPE.filter((t) => t !== 'BLACKLIST').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted mb-1 block text-[12px] font-medium">
                  Reason code
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) =>
                    setReasonCode(
                      e.target.value as (typeof SUSPENSION_REASON_CODE)[number],
                    )
                  }
                  className="border-line bg-panel text-ink w-full rounded-md border px-3 py-2 text-[13px]"
                >
                  {SUSPENSION_REASON_CODE.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {mode === 'blacklist' && (
            <div>
              <label className="text-muted mb-1 block text-[12px] font-medium">
                Legal Officer co-signer (user id)
              </label>
              <input
                value={cosignerId}
                onChange={(e) => setCosignerId(e.target.value)}
                placeholder="usr_… (a LEGAL_OFFICER)"
                className="border-line bg-panel text-ink w-full rounded-md border px-3 py-2 text-[13px]"
              />
              <p className="text-muted mt-1 text-[12px]">
                Blacklisting requires the MD to act and a Legal Officer to co-sign.
              </p>
            </div>
          )}

          <div>
            <label className="text-muted mb-1 block text-[12px] font-medium">
              Reason / notes
            </label>
            <textarea
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              rows={4}
              className="border-line bg-panel text-ink w-full rounded-md border px-3 py-2 text-[13px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Link href={`/vendors/${params.id}`}>
              <Button variant="default">Cancel</Button>
            </Link>
            <Button
              variant={mode === 'blacklist' ? 'danger' : 'primary'}
              disabled={suspend.isPending || blacklist.isPending}
              onClick={submit}
            >
              {mode === 'blacklist' ? 'Blacklist vendor' : 'Suspend vendor'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
