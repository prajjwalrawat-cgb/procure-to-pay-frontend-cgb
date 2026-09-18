'use client';

import {
  Badge,
  Button,
  PageHeader,
  Pill,
  SubNav,
} from '@/components/ui';
import type { LedgerEntryView } from '@/lib/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import {
  useAdjustStock,
  useLedgerEntry,
  useProductStock,
  useWriteOffDamage,
} from '@/lib/api/inventory';
import {
  Field,
  FormResult,
  LocationSelect,
  ProductSelect,
  TextArea,
  TextInput,
} from '../_components/form-controls';
import { formatSignedQty, txnLabel, txnVariant } from '../_components/txn-display';
import { formatDate } from '@/lib/format';

// useSearchParams() bails the page out of static rendering, so the search-param
// consumer must sit under a Suspense boundary (Next 14 requirement) — else
// `next build` fails prerendering this route.
export default function AdjustmentsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-muted">Loading…</div>}>
      <AdjustmentsScreen />
    </Suspense>
  );
}

/**
 * Adjustments — the sanctioned way to change a number that is already wrong.
 *
 * The ledger is insert-only, so nothing here edits an existing entry: a stock
 * adjustment posts a new signed ADJUSTMENT row and a write-off posts a
 * DAMAGE_WRITE_OFF. Arriving from a ledger row with `?correct=<entryId>`
 * pre-fills the exact reversal and links the two with `correctionOfId`, so the
 * mistake and its fix stay visible side by side.
 */
function AdjustmentsScreen(): React.JSX.Element {
  const params = useSearchParams();
  const correctId = params.get('correct');
  const { data: correcting, isLoading, isError } = useLedgerEntry(correctId);

  const [chosen, setChosen] = useState<'adjust' | 'damage'>('adjust');
  // Correcting an entry is always an adjustment, so the tab is not a choice then.
  const tab = correctId ? 'adjust' : chosen;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Adjustments"
        description="Correct a wrong count or write off damaged stock — both post a new ledger entry"
        actions={
          <>
            <Link href="/inventory/ledger">
              <Button variant="ghost" size="sm">
                Stock ledger
              </Button>
            </Link>
          </>
        }
      />

      {!correctId && (
        <SubNav
          className="mb-3"
          items={[
            { key: 'adjust', label: 'Stock adjustment' },
            { key: 'damage', label: 'Damage write-off' },
          ]}
          value={tab}
          onChange={(k) => setChosen(k as 'adjust' | 'damage')}
        />
      )}

      {correctId && isLoading && (
        <p className="mb-3 text-[13px] text-muted">Loading the entry to correct…</p>
      )}
      {correctId && isError && (
        <p className="mb-3 text-[13px] text-danger">
          That ledger entry could not be loaded — post a plain adjustment instead.
        </p>
      )}
      {correcting && <CorrectionBanner entry={correcting} />}

      {tab === 'adjust' ? (
        // Remount once the entry to correct arrives so it seeds the initial state.
        <AdjustmentForm key={correcting?.id ?? 'blank'} correcting={correcting ?? null} />
      ) : (
        <DamageForm />
      )}

      <p className="mt-3 text-[11px] text-faint">
        Nothing on this screen edits an existing entry. Stock figures are the sum of every
        ledger movement, so both the original and the correction stay in the audit trail.
      </p>
    </div>
  );
}

function CorrectionBanner({ entry }: { entry: LedgerEntryView }): React.JSX.Element {
  return (
    <div className="mb-4 rounded-lg border border-line bg-canvas p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge variant="classification">Correcting an entry</Badge>
        <Pill variant={txnVariant(entry.txnType)}>{txnLabel(entry.txnType)}</Pill>
      </div>
      <p className="text-[13px] text-text">
        {entry.productName}
        {entry.colour ? `, ${entry.colour}` : ''}{' '}
        <span className="font-numeric text-faint">({entry.productCode})</span>,{' '}
        {entry.locationName} ,{' '}
        <span className="font-numeric">{formatSignedQty(entry.signedQty)}</span> on{' '}
        {formatDate(entry.txnDate)}
      </p>
      <p className="mt-1 text-[11px] text-faint">
        The quantity below is pre-filled to reverse it exactly. Change it if only part of
        the entry was wrong.
      </p>
    </div>
  );
}

function AdjustmentForm({
  correcting,
}: {
  correcting: LedgerEntryView | null;
}): React.JSX.Element {
  const [productId, setProductId] = useState(correcting?.productId ?? '');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState(correcting?.locationId ?? '');
  const [signedQty, setSignedQty] = useState(
    correcting ? String(-correcting.signedQty) : '',
  );
  const [reason, setReason] = useState(
    correcting
      ? `Reverses ${txnLabel(correcting.txnType).toLowerCase()} ${correcting.id}`
      : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const adjust = useAdjustStock();
  const delta = Number(signedQty);
  const onHand = useLocationQty(productId, locationId);

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await adjust.mutateAsync({
        productId,
        locationId,
        signedQty: delta,
        reason,
        correctionOfId: correcting?.id ?? null,
      });
      setSuccess(`Adjustment posted (${res.id}).`);
      setSignedQty('');
      if (!correcting) setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post the adjustment');
    }
  }

  const wholeNumber = Number.isInteger(delta);
  const ready =
    !!productId && !!locationId && delta !== 0 && wholeNumber && reason.trim().length > 0;

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Product" required>
            <ProductSelect
              value={productId}
              onChange={setProductId}
              search={search}
              onSearchChange={setSearch}
            />
          </Field>
        </div>
        <Field label="Location" required>
          <LocationSelect value={locationId} onChange={setLocationId} />
        </Field>
        <Field
          label="Adjust by"
          required
          hint="Signed: 5 adds five, −5 removes five. Never zero."
        >
          <TextInput
            type="number"
            step={1}
            value={signedQty}
            onChange={(e) => setSignedQty(e.target.value)}
            placeholder="e.g. -3"
          />
        </Field>
        <div className="col-span-2">
          <Field
            label="Reason"
            required
            hint="Recorded on the ledger entry — say what went wrong."
          >
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Stock count shortfall, keyed the wrong quantity…"
            />
          </Field>
        </div>
      </div>

      <StockPreview onHand={onHand} delta={ready ? delta : 0} negativeAllowed />

      {!wholeNumber && signedQty !== '' && (
        <p className="mt-2 text-[12px] text-danger">
          Stock moves in whole units — enter a whole number.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <FormResult error={error} success={success} />
        <Button
          variant="primary"
          size="sm"
          disabled={!ready || adjust.isPending}
          onClick={() => void submit()}
        >
          {adjust.isPending ? 'Posting…' : 'Post adjustment'}
        </Button>
      </div>
    </div>
  );
}

function DamageForm(): React.JSX.Element {
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const writeOff = useWriteOffDamage();
  const onHand = useLocationQty(productId, locationId);
  const amount = Number(qty);

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await writeOff.mutateAsync({
        productId,
        locationId,
        qty: amount,
        reason,
        remark: remark || null,
      });
      setSuccess(`Damage written off (${res.id}).`);
      setQty('');
      setReason('');
      setRemark('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write off the damage');
    }
  }

  const ready =
    !!productId &&
    !!locationId &&
    amount > 0 &&
    Number.isInteger(amount) &&
    !!reason.trim();
  // Blocked client-side rather than round-tripping to a certain 409. Unknown
  // stock (still loading) is not treated as zero — let the API decide then.
  const exceedsStock = onHand !== null && amount > onHand;

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Product" required>
            <ProductSelect
              value={productId}
              onChange={setProductId}
              search={search}
              onSearchChange={setSearch}
            />
          </Field>
        </div>
        <Field label="Location" required>
          <LocationSelect value={locationId} onChange={setLocationId} />
        </Field>
        <Field
          label="Damaged quantity"
          required
          hint="Always positive — it writes stock down."
        >
          <TextInput
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Reason" required>
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Broken in transit, water damage, expired…"
            />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Remark">
            <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
        </div>
      </div>

      <StockPreview onHand={onHand} delta={ready ? -amount : 0} negativeAllowed={false} />

      <div className="mt-4 flex items-center justify-between">
        <FormResult error={error} success={success} />
        <Button
          variant="primary"
          size="sm"
          disabled={!ready || exceedsStock || writeOff.isPending}
          onClick={() => void submit()}
        >
          {writeOff.isPending ? 'Posting…' : 'Write off damage'}
        </Button>
      </div>
      <div className="mt-3">
        <Pill variant="gray">
          Counts towards the product&rsquo;s Damage Qty. — it does not come back
        </Pill>
      </div>
    </div>
  );
}

/** Stock on hand for one product at one location, or null until both are picked. */
function useLocationQty(productId: string, locationId: string): number | null {
  const { data } = useProductStock(productId || null);
  if (!productId || !locationId || !data) return null;
  return data.locations.find((l) => l.locationId === locationId)?.qty ?? 0;
}

/**
 * Shows the figure being changed and what it becomes, so nobody posts a
 * correction blind — the commonest way to turn one wrong number into two.
 *
 * The two forms differ on going negative: an adjustment is how a stock count is
 * reconciled, so it is allowed to (the negative IS the discrepancy). A damage
 * write-off is not — you cannot damage stock you do not hold, and the API
 * refuses it with a 409.
 */
function StockPreview({
  onHand,
  delta,
  negativeAllowed,
}: {
  onHand: number | null;
  delta: number;
  negativeAllowed: boolean;
}): React.JSX.Element | null {
  if (onHand === null) return null;
  const after = onHand + delta;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-canvas px-3 py-2 text-[13px]">
      <span className="text-muted">At this location</span>
      <span className="font-numeric font-medium text-ink">
        {onHand.toLocaleString('en-IN')}
      </span>
      {delta !== 0 && (
        <>
          <span className="text-faint">→</span>
          <span
            className={
              'font-numeric font-semibold ' + (after < 0 ? 'text-danger' : 'text-ink')
            }
          >
            {after.toLocaleString('en-IN')}
          </span>
          <span
            className={'text-[12px] ' + (delta > 0 ? 'text-success' : 'text-danger')}
          >
            ({formatSignedQty(delta)})
          </span>
        </>
      )}
      {after < 0 && (
        <span className="text-[12px] text-warn">
          {negativeAllowed
            ? 'Goes negative — allowed here, the shortfall is what you are recording.'
            : 'More than is on hand — the write-off will be refused.'}
        </span>
      )}
    </div>
  );
}
