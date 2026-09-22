'use client';

import { PERMISSIONS } from '@/lib/shared';
import { PageHeader } from '@/components/ui';

import { CommandBar } from '@/components/analytics/command-bar';
import { exportAnalytics } from '@/components/analytics/export';
import { MsmeComplianceSection } from '@/components/analytics/msme-compliance';
import { OverviewStrip } from '@/components/analytics/overview-strip';
import { PENDING } from '@/components/analytics/primitives';
import { isComplete, toApiRange, useAnalyticsRange, type UrlRange } from '@/components/analytics/range';
import { SpendSavingsSection } from '@/components/analytics/spend-savings';
import { VelocitySection } from '@/components/analytics/velocity';
import {
  useAnalyticsOverview,
  useMsmeCompliance,
  useRefreshAnalytics,
  useSpendByCategoryRange,
  useSpendSavings,
  useVelocity,
} from '@/lib/api/analytics';
import { useHasPermission } from '@/lib/permissions';

import { AnalyticsTabs, AsOfBadge } from './_lib';

/**
 * Analytics overview: one volumetric strip, then three co-equal sections.
 *
 * The monthly spend trend chart that used to lead this page is gone on
 * purpose — every panel here is a total or a distribution for the chosen
 * range, and the sections share one layout so none of them outweighs the
 * others.
 */
export default function AnalyticsPage(): React.JSX.Element {
  const { range, setRange, ready } = useAnalyticsRange();

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Spend, operational velocity and MSME compliance, computed from posted documents."
      />
      <AnalyticsTabs active="/analytics" />
      {/* Until the URL is read the sections render as skeletons and fetch
          nothing, so a shared ?period=LAST_24M link never flashes 12-month
          figures first. */}
      {ready ? (
        <AnalyticsBody range={range} setRange={setRange} />
      ) : (
        <Layout
          range={range}
          setRange={setRange}
          asOf={null}
          exportDisabled
          onExport={() => undefined}
          overview={PENDING}
          savings={PENDING}
          category={PENDING}
          velocity={PENDING}
          msme={PENDING}
        />
      )}
    </div>
  );
}

function AnalyticsBody({
  range,
  setRange,
}: {
  range: UrlRange;
  setRange: (r: UrlRange) => void;
}): React.JSX.Element {
  // A custom range is only complete once both dates are valid; the command
  // bar never pushes an incomplete one, but a hand-edited URL could.
  const api = toApiRange(isComplete(range) ? range : { period: 'LAST_12M' });
  const overview = useAnalyticsOverview(api);
  const savings = useSpendSavings(api);
  const category = useSpendByCategoryRange(api);
  const velocity = useVelocity(api);
  const msme = useMsmeCompliance(api);

  const all = [overview, savings, category, velocity, msme];
  const anyLoading = all.some((q) => q.isLoading);
  const anyData = all.some((q) => q.data !== undefined);

  return (
    <Layout
      range={range}
      setRange={setRange}
      asOf={overview.data?.asOf ?? null}
      exportDisabled={anyLoading || !anyData}
      onExport={() =>
        exportAnalytics(range, {
          overview: overview.data,
          savings: savings.data,
          category: category.data,
          velocity: velocity.data,
          msme: msme.data,
        })
      }
      overview={overview}
      savings={savings}
      category={category}
      velocity={velocity}
      msme={msme}
    />
  );
}

function Layout({
  range,
  setRange,
  asOf,
  exportDisabled,
  onExport,
  overview,
  savings,
  category,
  velocity,
  msme,
}: {
  range: UrlRange;
  setRange: (r: UrlRange) => void;
  asOf: string | null;
  exportDisabled: boolean;
  onExport: () => void;
  overview: React.ComponentProps<typeof OverviewStrip>['query'];
  savings: React.ComponentProps<typeof SpendSavingsSection>['savings'];
  category: React.ComponentProps<typeof SpendSavingsSection>['category'];
  velocity: React.ComponentProps<typeof VelocitySection>['query'];
  msme: React.ComponentProps<typeof MsmeComplianceSection>['query'];
}): React.JSX.Element {
  const canManage = useHasPermission(PERMISSIONS.ANALYTICS_MANAGE);
  const refresh = useRefreshAnalytics();

  return (
    <>
      <CommandBar
        range={range}
        onRange={setRange}
        onExport={onExport}
        exportDisabled={exportDisabled}
        trailing={
          // A manual recompute is an analytics:manage action; everyone else
          // just sees how fresh the figures are. Hidden until there is an
          // `asOf`, since the badge reads a null stamp as "Live".
          asOf ? (
            <AsOfBadge
              refreshedAt={asOf}
              onRefresh={canManage ? () => refresh.mutate() : undefined}
              refreshing={refresh.isPending}
            />
          ) : null
        }
      />
      <div className="flex flex-col gap-8">
        <OverviewStrip query={overview} />
        <SpendSavingsSection savings={savings} category={category} />
        <VelocitySection query={velocity} />
        <MsmeComplianceSection query={msme} />
      </div>
    </>
  );
}
