'use client';

import { useState } from 'react';

import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { QUEUED_MESSAGE, QtyField, ResultBanner } from '@/components/scan/scan-ui';
import { Button } from '@/components/ui';
import {
  useCompleteCount,
  useCountScan,
  useCountSession,
  useStartCount,
} from '@/lib/api/scan';

/**
 * Cycle count — start a bin, scan what is on the shelf, submit for review.
 *
 * There is deliberately no approve button here. Approval writes adjustments to
 * an immutable ledger and belongs to whoever holds `inventory:adjust`, at a
 * desk, looking at the variance list — not to the person who just did the
 * counting, on the device they counted with. The screen ends at "sent for
 * review" on purpose.
 */
export default function ScanCountPage(): React.JSX.Element {
  const [sessionId, setSessionId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [banner, setBanner] = useState<{
    tone: 'ok' | 'queued' | 'error';
    message: string;
  } | null>(null);

  const start = useStartCount();
  const session = useCountSession(sessionId);
  const countScan = useCountScan(sessionId);
  const complete = useCompleteCount();

  async function onBinScan(binBarcodeRaw: string): Promise<void> {
    setBanner(null);
    try {
      const created = await start.mutateAsync({ binBarcodeRaw });
      setSessionId(created.id);
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not start the count.',
      });
    }
  }

  async function onProductScan(barcodeRaw: string): Promise<void> {
    if (Number(quantity) <= 0) return;
    setBanner(null);
    try {
      const outcome = await countScan.mutateAsync({
        barcodeRaw,
        quantity: Number(quantity),
      });
      setBanner(
        outcome.queued
          ? { tone: 'queued', message: QUEUED_MESSAGE }
          : { tone: 'ok', message: `Counted ${quantity}.` },
      );
      await session.refetch();
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'That count was rejected.',
      });
    }
  }

  async function submitForReview(): Promise<void> {
    setBanner(null);
    try {
      await complete.mutateAsync(sessionId);
      await session.refetch();
      setBanner({
        tone: 'ok',
        message: 'Count sent for review. Stock will not change until it is approved.',
      });
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not complete the count.',
      });
    }
  }

  const status = session.data?.status;

  return (
    <div className="space-y-4">
      {!sessionId ? (
        <section className="space-y-2 rounded-lg border border-line bg-panel p-3">
          <h2 className="text-body font-semibold">Scan the bin to count</h2>
          <BarcodeScanner
            label="bin label"
            onScan={(v) => void onBinScan(v)}
            busy={start.isPending}
          />
        </section>
      ) : null}

      {banner ? <ResultBanner tone={banner.tone} message={banner.message} /> : null}

      {session.data ? (
        <section className="space-y-2 rounded-lg border border-line bg-panel p-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-h3 font-semibold">{session.data.locationName}</h2>
            <span className="text-caption text-muted">
              {status?.replace('_', ' ').toLowerCase()}
            </span>
          </div>

          {session.data.countedSoFar.length > 0 ? (
            <ul className="divide-y divide-line">
              {session.data.countedSoFar.map((row) => (
                <li key={row.productId} className="flex justify-between py-2 text-body-sm">
                  <span>{row.productName}</span>
                  <span className="tabular-nums">{row.countedQty}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-muted">Nothing counted yet.</p>
          )}
        </section>
      ) : null}

      {sessionId && status === 'IN_PROGRESS' ? (
        <>
          <section className="space-y-3 rounded-lg border border-line bg-panel p-3">
            <QtyField value={quantity} onChange={setQuantity} label="Counted quantity" />
            <BarcodeScanner
              label="product barcode"
              onScan={(v) => void onProductScan(v)}
              busy={countScan.isPending}
            />
          </section>

          <Button
            type="button"
            variant="primary"
            className="h-12 w-full text-h3"
            disabled={complete.isPending}
            onClick={() => void submitForReview()}
          >
            {complete.isPending ? 'Submitting…' : 'Finish count and send for review'}
          </Button>
        </>
      ) : null}

      {status === 'PENDING_REVIEW' && session.data ? (
        <section className="space-y-2 rounded-lg border border-line bg-panel p-3">
          <h2 className="text-body font-semibold">Variances awaiting approval</h2>
          <ul className="divide-y divide-line">
            {session.data.variances.map((v) => (
              <li key={v.productId} className="flex justify-between py-2 text-body-sm">
                <span>{v.productName}</span>
                <span className="tabular-nums">
                  {v.countedQty} counted / {v.expectedQty} expected
                  <strong
                    className={
                      v.deltaQty === 0 ? '' : v.deltaQty > 0 ? 'text-ok' : 'text-danger'
                    }
                  >
                    {' '}
                    {v.deltaQty > 0 ? `+${v.deltaQty}` : v.deltaQty}
                  </strong>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted">
            A supervisor approves these — nothing has moved in the ledger yet.
          </p>
        </section>
      ) : null}
    </div>
  );
}
