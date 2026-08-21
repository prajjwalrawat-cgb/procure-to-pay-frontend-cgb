'use client';

import { useState } from 'react';

import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import {
  QUEUED_MESSAGE,
  QtyField,
  ResultBanner,
  TextField,
} from '@/components/scan/scan-ui';
import { Button } from '@/components/ui';
import { usePickList, useScanPick } from '@/lib/api/scan';
import type { PickListLineView } from '@/lib/shared';

/**
 * Pick — a live checklist for one order.
 *
 * The list is the screen. An operator picking a multi-line order needs to see
 * what is left at a glance, and needs the count to move the instant a scan
 * lands, which is why the list refetches after every pick rather than tracking
 * progress locally: the server's FEFO allocation is the truth about what was
 * actually consumed.
 */
export default function ScanPickPage(): React.JSX.Element {
  const [orderRef, setOrderRef] = useState('');
  const [activeOrder, setActiveOrder] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [banner, setBanner] = useState<{
    tone: 'ok' | 'queued' | 'error';
    message: string;
  } | null>(null);

  const list = usePickList(activeOrder);
  const pick = useScanPick();

  async function onScan(barcodeRaw: string): Promise<void> {
    if (!activeOrder || Number(quantity) <= 0) return;
    setBanner(null);
    try {
      const outcome = await pick.mutateAsync({
        orderId: activeOrder,
        barcodeRaw,
        quantity: Number(quantity),
      });

      if (outcome.queued) {
        setBanner({ tone: 'queued', message: QUEUED_MESSAGE });
      } else {
        const allocations = outcome.data?.allocations ?? [];
        const batches = allocations
          .map((a) => a.batchNumber ?? 'no batch')
          .filter((b, i, arr) => arr.indexOf(b) === i)
          .join(', ');
        setBanner({
          tone: 'ok',
          message: outcome.data?.orderComplete
            ? 'Order complete.'
            : `Picked from ${batches} — ${outcome.data?.line.remaining ?? 0} left on this line.`,
        });
      }
      await list.refetch();
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'The pick was rejected.',
      });
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-line bg-white p-3">
        <TextField
          label="Order reference"
          value={orderRef}
          onChange={setOrderRef}
          placeholder="e.g. AMZ-1001"
        />
        <Button
          type="button"
          className="w-full"
          disabled={!orderRef.trim()}
          onClick={() => {
            setBanner(null);
            setActiveOrder(orderRef.trim());
          }}
        >
          Open pick list
        </Button>
      </section>

      {banner ? <ResultBanner tone={banner.tone} message={banner.message} /> : null}

      {list.isError ? (
        <ResultBanner
          tone="error"
          message={
            list.error instanceof Error
              ? list.error.message
              : 'No pick list for that order.'
          }
        />
      ) : null}

      {list.data ? (
        <>
          <section className="space-y-2 rounded-lg border border-line bg-white p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">{list.data.orderRef}</h2>
              <span className="text-[12px] tabular-nums text-muted">
                {list.data.totalPicked}/{list.data.totalRequired}
              </span>
            </div>

            <ul className="divide-y divide-line">
              {list.data.lines.map((line: PickListLineView) => (
                <li
                  key={line.productId}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className={line.complete ? 'opacity-50' : ''}>
                    <p className="text-[14px] font-medium">{line.productName}</p>
                    <p className="text-[12px] text-muted">{line.productCode}</p>
                  </div>
                  <span
                    className={
                      'rounded px-2 py-1 text-[12px] tabular-nums ' +
                      (line.complete ? 'bg-ok/15 text-ok' : 'bg-accent/10 text-accent')
                    }
                  >
                    {line.qtyPicked}/{line.qtyRequired}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {list.data.status === 'PICKED' ? (
            <ResultBanner tone="ok" message="Every line is picked." />
          ) : (
            <section className="space-y-3 rounded-lg border border-line bg-white p-3">
              <QtyField
                value={quantity}
                onChange={setQuantity}
                label="Quantity per scan"
              />
              <BarcodeScanner
                label="product barcode"
                onScan={(v) => void onScan(v)}
                busy={pick.isPending}
              />
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
