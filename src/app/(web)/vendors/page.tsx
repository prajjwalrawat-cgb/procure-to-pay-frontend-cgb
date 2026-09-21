'use client';

import {
  Badge,
  Button,
  Card,
  CardFooter,
  CardGrid,
  CardHeader,
  CardMeta,
  CardTitle,
  DataState,
  PageHeader,
  SubNav,
} from '@/components/ui';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { InviteVendorDialog } from './_components/invite-dialog';
import { useVendorList, type VendorTab } from '@/lib/api/vendors';
import { humanise, inr } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/shared';

const TABS: { key: VendorTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'blacklisted', label: 'Blacklisted' },
  { key: 'all', label: 'All' },
];

/**
 * Vendors are a comparison view, so they are cards rather than a table: the
 * question here is "which of these suppliers do I go to", not "what happened
 * to record 4408". A card can carry the grade, the MSME status and the spend
 * side by side at a size you can actually compare across a grid; the same
 * facts in a 9-column table are a wall.
 */
export default function VendorsPage(): React.JSX.Element {
  const [tab, setTab] = useState<VendorTab>('active');
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useVendorList(tab);
  const canInvite = useHasPermission(PERMISSIONS.VENDOR_INVITE);
  const canSeeQueue = useHasPermission(PERMISSIONS.VENDOR_ONBOARDING_READ);

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Onboarding, compliance, scorecards and lifecycle."
        actions={
          <>
            {canSeeQueue && (
              <Link href="/vendors/onboarding">
                <Button variant="secondary" size="sm">
                  Onboarding queue
                </Button>
              </Link>
            )}
            {canInvite && (
              <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                Invite vendor
              </Button>
            )}
          </>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={(k) => setTab(k as VendorTab)}
      />

      {/* Error stays distinct from empty: a 403 rendering as "no vendors"
          reads as an empty tenant rather than as missing access. */}
      <DataState
        isLoading={isLoading}
        error={isError ? error : undefined}
        isEmpty={!data || data.items.length === 0}
        onRetry={() => void refetch()}
        empty={{
          title: 'No vendors in this view',
          detail:
            'Suppliers appear here once they are invited and have completed onboarding.',
          action: canInvite ? (
            <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
              Invite vendor
            </Button>
          ) : undefined,
        }}
      >
        <CardGrid>
          {data?.items.map((v) => (
            <Card key={v.id} interactive>
              <CardHeader
                badge={
                  v.isMsme ? (
                    <Badge variant="classification">MSME</Badge>
                  ) : v.lifecycleStatus === 'ACTIVE' ? (
                    <Badge variant="positive" icon={BadgeCheck}>
                      Verified
                    </Badge>
                  ) : null
                }
              >
                <CardTitle>{v.name}</CardTitle>
                <CardMeta>
                  <span className="font-numeric">{v.code}</span>
                  {v.category ? (
                    <span className="text-faint"> — {humanise(v.category)}</span>
                  ) : null}
                </CardMeta>
              </CardHeader>

              <div className="grid grid-cols-3 gap-3 px-4 pb-3">
                <Metric label="FYTD spend" value={inr(v.fytdSpend, 0)} />
                <Metric label="Active POs" value={String(v.activePoCount)} />
                <Metric
                  label="Scorecard"
                  value={v.scorecardGrade}
                  fallback="No history"
                />
              </div>

              <CardFooter
                action={
                  <Link href={`/vendors/${v.id}`}>
                    <Button variant="secondary" size="sm">
                      View profile
                    </Button>
                  </Link>
                }
              >
                {v.riskGrade
                  ? `Risk grade ${v.riskGrade}`
                  : 'Risk grade not yet assessed'}
              </CardFooter>
            </Card>
          ))}
        </CardGrid>
      </DataState>

      <InviteVendorDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

/**
 * One figure on a card. A metric with no data says why in words rather than
 * rendering a dash or a dead "0%" — a scorecard that reads 0 is a claim the
 * supplier performed badly, which is not what "we have not traded with them
 * yet" means.
 */
function Metric({
  label,
  value,
  fallback = '—',
}: {
  label: string;
  value: string | null | undefined;
  fallback?: string;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-faint text-micro">{label}</p>
      {value ? (
        <p className="font-numeric text-ink truncate text-body-sm font-medium">{value}</p>
      ) : (
        <p className="text-muted truncate text-caption">{fallback}</p>
      )}
    </div>
  );
}
