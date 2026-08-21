'use client';

import { useState } from 'react';

import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import {
  ProductCard,
  QUEUED_MESSAGE,
  QtyField,
  ResultBanner,
  TextField,
} from '@/components/scan/scan-ui';
import { Button } from '@/components/ui';
import { useResolveBarcode, useScanReceive } from '@/lib/api/scan';
import type { ScanResolveResponse } from '@/lib/shared';

/**
 * Receive — book stock in against a purchase order.
 *
 * Batch-tracked products demand a batch number and an expiry, and the screen
 * will not submit without them. That mirrors the server's 422 rather than
 * duplicating a rule: the check exists here so the operator finds out while
 * holding the pack, not after a round trip.
 */
export default function ScanReceivePage(): React.JSX.Element {
  const [resolved, setResolved] = useState<ScanResolveResponse | null>(null);
  const [barcodeRaw, setBarcodeRaw] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locationId, setLocationId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [poId, setPoId] = useState('');
  const [nonPoReason, setNonPoReason] = useState('');
  const [banner, setBanner] = useState<{
    tone: 'ok' | 'queued' | 'error';
    message: string;
  } | null>(null);

  const resolve = useResolveBarcode();
  const receive = useScanReceive();

  async function onScan(value: string): Promise<void> {
    setBanner(null);
    setBarcodeRaw(value);
    try {
      setResolved(await resolve.mutateAsync(value));
    } catch (err) {
      setResolved(null);
      setBanner({
        tone: 'error',
        message:
          err instanceof Error
            ? `${err.message} — check the code, or register this barcode first.`
            : 'Barcode not recognised.',
      });
    }
  }

  const needsBatch = resolved?.product.requiresBatchTracking ?? false;
  const ready =
    !!resolved &&
    Number(quantity) > 0 &&
    locationId.trim().length > 0 &&
    (!needsBatch || (batchNumber.trim().length > 0 && expiryDate.length > 0)) &&
    (poId.trim().length > 0 || nonPoReason.trim().length > 0);

  async function submit(): Promise<void> {
    if (!resolved) return;
    setBanner(null);
    const usingOverride = poId.trim().length === 0;

    try {
      const outcome = await receive.mutateAsync({
        barcodeRaw,
        quantity: Number(quantity),
        locationId: locationId.trim(),
        batchNumber: batchNumber.trim() || null,
        // A date input gives "2027-01-31"; the API wants an instant.
        expiryDate: expiryDate
          ? new Date(`${expiryDate}T00:00:00.000Z`).toISOString()
          : null,
        purchaseOrderId: usingOverride ? null : poId.trim(),
        nonPoReceipt: usingOverride,
        nonPoReason: usingOverride ? nonPoReason.trim() : null,
      });

      if (outcome.queued) {
        setBanner({ tone: 'queued', message: QUEUED_MESSAGE });
      } else {
        setBanner({
          tone: 'ok',
          message: `Received ${quantity} — ${outcome.data?.currentStockLevel ?? '?'} now at this location.`,
        });
      }
      // Keep the location and PO: a pallet is booked in line by line.
      setResolved(null);
      setQuantity('');
      setBatchNumber('');
      setExpiryDate('');
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'The receipt was rejected.',
      });
    }
  }

  return (
    <div className="space-y-4">
      <BarcodeScanner
        label="product barcode"
        onScan={(v) => void onScan(v)}
        busy={resolve.isPending}
      />

      {banner ? <ResultBanner tone={banner.tone} message={banner.message} /> : null}

      {resolved ? (
        <ProductCard resolved={resolved}>
          <div className="space-y-3 pt-2">
            <QtyField value={quantity} onChange={setQuantity} />
            <TextField
              label="Location / dock"
              value={locationId}
              onChange={setLocationId}
              placeholder="Location id"
            />

            {needsBatch ? (
              <>
                <TextField
                  label="Batch / lot number"
                  value={batchNumber}
                  onChange={setBatchNumber}
                />
                <TextField
                  label="Expiry date"
                  type="date"
                  value={expiryDate}
                  onChange={setExpiryDate}
                />
              </>
            ) : null}

            <TextField
              label="Purchase order"
              value={poId}
              onChange={setPoId}
              placeholder="PO id — leave blank for a Challan-only receipt"
            />
            {poId.trim().length === 0 ? (
              <TextField
                label="Reason for receiving without a PO"
                value={nonPoReason}
                onChange={setNonPoReason}
                placeholder="Required — this is recorded on the ledger entry"
              />
            ) : null}

            <Button
              type="button"
              className="w-full py-4 text-[16px]"
              disabled={!ready || receive.isPending}
              onClick={() => void submit()}
            >
              {receive.isPending ? 'Receiving…' : 'Confirm receipt'}
            </Button>
          </div>
        </ProductCard>
      ) : null}
    </div>
  );
}
