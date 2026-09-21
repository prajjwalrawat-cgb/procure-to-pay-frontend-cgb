'use client';

import { Button, PageHeader, SubNav } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { RequisitionBoard } from '@/components/requisitions/board';
import { RequisitionListView } from '@/components/requisitions/list-view';
import type { RequisitionTab } from '@/lib/api/requisitions';
import { useInitialTab } from '@/lib/use-initial-tab';

const TABS: { key: RequisitionTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'my_approval', label: 'My approval' },
  { key: 'draft', label: 'Draft' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'closed', label: 'Closed' },
];
const TAB_KEYS = TABS.map((t) => t.key);

export default function RequisitionsPage(): React.JSX.Element {
  const [tab, setTab] = useState<RequisitionTab>('active');
  // Deep links from Home, e.g. /requisitions?tab=my_approval.
  useInitialTab(TAB_KEYS, setTab);

  return (
    <div>
      <PageHeader
        title="Requisitions"
        description="Requests raised across the organisation, from draft to receipt."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/requisitions/new">New requisition</Link>
          </Button>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={(k) => setTab(k as RequisitionTab)}
      />

      {/* Keyed so filters, search and selection start fresh per tab. */}
      {tab === 'active' ? <RequisitionBoard /> : <RequisitionListView key={tab} tab={tab} />}
    </div>
  );
}
