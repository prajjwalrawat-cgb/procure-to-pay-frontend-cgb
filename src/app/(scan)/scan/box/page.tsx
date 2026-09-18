'use client';

import { useState } from 'react';

import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { QtyField, ResultBanner } from '@/components/scan/scan-ui';
import { Button } from '@/components/ui';
import { useBoxByBarcode, useMoveBox, usePackBox, useUnpackBox } from '@/lib/api/box';
import type { BoxContentLine, LocationPath } from '@/lib/shared';

type Mode = 'view' | 'pack' | 'unpack' | 'move';

/** "Main Warehouse › Rack A › Section A1", skipping levels nobody labelled. */
function pathLabel(path: LocationPath, fallback: string): string {
  const parts = [path.warehouse, path.rack, path.section].filter(Boolean);
  return parts.length > 0 ? parts.join(' › ') : fallback;
}

/**
 * Box — scan a carton and see exactly what is in it and where it sits, then
 * fill it, empty it, or move it.
 *
 * The contents list is the point of the screen. It is derived from the ledger
 * on every read rather than cached, because the question being asked is "what
 * is in the box I am holding right now", and a stale answer is worse than a
 * slow one.
 */
export default function ScanBoxPage(): React.JSX.Element {
  const [barcode, setBarcode] = useState('');
  const [mode, setMode] = useState<Mode>('view');
  const [quantity, setQuantity] = useState('1');
  const [banner, setBanner] = useState<{
    tone: 'ok' | 'queued' | 'error';
    message: string;
  } | null>(null);

  const box = useBoxByBarcode(barcode);
  const pack = usePackBox();
  const unpack = useUnpackBox();
  const moveBox = useMoveBox();

  const busy = pack.isPending || unpack.isPending || moveBox.isPending;

  async function onProductScan(productBarcode: string): Promise<void> {
    setBanner(null);
    const body = {
      boxBarcodeRaw: barcode,
      barcodeRaw: productBarcode,
      quantity: Number(quantity),
    };
    try {
      const result =
        mode === 'pack' ? await pack.mutateAsync(body) : await unpack.mutateAsync(body);
      setBanner({
        tone: 'ok',
        message:
          mode === 'pack'
            ? `Packed ${quantity} into ${result.box.code}.`
            : `Removed ${quantity} from ${result.box.code}.`,
      });
      setMode('view');
      await box.refetch();
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'That did not work.',
      });
    }
  }

  async function onDestinationScan(binBarcode: string): Promise<void> {
    setBanner(null);
    try {
      const result = await moveBox.mutateAsync({
        boxBarcodeRaw: barcode,
        toBinBarcodeRaw: binBarcode,
      });
      setBanner({
        tone: 'ok',
        message: `Moved to ${result.to.name}${
          result.entriesPosted > 0
            ? ` with ${result.entriesPosted / 2} line(s) inside`
            : ' (empty)'
        }.`,
      });
      setMode('view');
      await box.refetch();
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'The move was rejected.',
      });
    }
  }

  return (
    <div className="space-y-4">
      {!barcode ? (
        <section className="space-y-2 rounded-lg border border-line bg-white p-3">
          <h2 className="text-[14px] font-semibold">Scan a box label</h2>
          <BarcodeScanner label="box label" onScan={setBarcode} />
        </section>
      ) : null}

      {banner ? <ResultBanner tone={banner.tone} message={banner.message} /> : null}

      {box.isError ? (
        <ResultBanner
          tone="error"
          message={box.error instanceof Error ? box.error.message : 'Box not recognised.'}
        />
      ) : null}

      {box.data ? (
        <>
          <section className="space-y-2 rounded-lg border border-line bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-semibold">{box.data.code}</h2>
                <p className="font-mono text-[11px] text-muted">{box.data.barcode}</p>
              </div>
              <span className="text-[12px] tabular-nums text-muted">
                {box.data.totalQty} pcs, {box.data.distinctProducts} SKU
              </span>
            </div>

            <p className="text-[13px]">
              {box.data.location
                ? pathLabel(box.data.location.path, box.data.location.name)
                : 'Not placed on a shelf yet'}
            </p>
            {!box.data.active ? (
              <p className="text-[12px] text-danger">This box is retired.</p>
            ) : null}
          </section>

          <section className="space-y-2 rounded-lg border border-line bg-white p-3">
            <h3 className="text-[14px] font-semibold">Contents</h3>
            {box.data.contents.length === 0 ? (
              <p className="text-[13px] text-muted">Empty.</p>
            ) : (
              <ul className="divide-y divide-line">
                {box.data.contents.map((line: BoxContentLine, i) => (
                  <li
                    key={`${line.productId}-${line.batchNumber ?? 'none'}-${i}`}
                    className="py-2"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-medium">{line.productName}</span>
                      <span className="text-[14px] tabular-nums">{line.qty}</span>
                    </div>
                    <p className="text-[12px] text-muted">
                      {line.productCode}
                      {line.batchNumber ? `, batch ${line.batchNumber}` : ''}
                      {line.expiryDate ? `, exp ${line.expiryDate.slice(0, 10)}` : ''}
                    </p>
                    {line.expired ? (
                      <p className="text-[12px] text-danger">Expired — do not ship.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {mode === 'view' ? (
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" disabled={busy} onClick={() => setMode('pack')}>
                Add stock
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={busy || box.data.contents.length === 0}
                onClick={() => setMode('unpack')}
              >
                Remove
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={busy}
                onClick={() => setMode('move')}
              >
                Move box
              </Button>
            </div>
          ) : null}

          {mode === 'pack' || mode === 'unpack' ? (
            <section className="space-y-3 rounded-lg border border-line bg-white p-3">
              <h3 className="text-[14px] font-semibold">
                {mode === 'pack' ? 'Add stock to this box' : 'Remove stock from this box'}
              </h3>
              <QtyField value={quantity} onChange={setQuantity} />
              <BarcodeScanner
                label="product barcode"
                onScan={(v) => void onProductScan(v)}
                busy={busy || Number(quantity) <= 0}
              />
            </section>
          ) : null}

          {mode === 'move' ? (
            <section className="space-y-2 rounded-lg border border-line bg-white p-3">
              <h3 className="text-[14px] font-semibold">
                Scan the section it is going to
              </h3>
              <p className="text-[12px] text-muted">
                Everything inside moves with the box.
              </p>
              <BarcodeScanner
                label="section label"
                onScan={(v) => void onDestinationScan(v)}
                busy={busy}
              />
            </section>
          ) : null}

          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={() => {
              if (mode === 'view') {
                setBarcode('');
                setBanner(null);
              } else {
                setMode('view');
              }
            }}
          >
            {mode === 'view' ? 'Scan a different box' : 'Cancel'}
          </Button>
        </>
      ) : null}
    </div>
  );
}
