'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { openAuthedAsset } from '@/lib/api-client';
import {
  useImportBatch,
  useImportBatches,
  useReprocessImport,
  useResolveImportRow,
  useUploadImport,
} from '@/lib/api/inventory';

type ImportType = 'PRODUCT_MASTER' | 'STOCK_LEDGER';

/** Columns the pipeline reads, shown as a mapping preview before upload. */
const EXPECTED_COLUMNS: Record<ImportType, string[]> = {
  PRODUCT_MASTER: [
    'product_name *',
    'category',
    'colour',
    // Slice 13 — the pack's EAN/UPC. Also accepted as ean / upc / gtin / bar_code.
    // Re-uploading the sheet with this column filled is how a whole catalogue
    // becomes scannable; a blank cell leaves an existing barcode untouched.
    'barcode',
    'image_link',
    'unit',
    'opening_stock',
    'damage_qty',
    'location',
    'rack_no',
    'expiry_waranty_date',
    'product_id',
    'sku',
    'remark',
  ],
  STOCK_LEDGER: [
    'product_name *',
    'colour',
    'txn_type *',
    'qty *',
    'location *',
    'date',
    'vendor',
    'rate',
    'tax',
    'qc_status',
    'department',
    'issued_to',
    'platform',
    'order_id',
    'customer_name',
    'remark',
    'source_row_ref',
  ],
};

export default function BulkUploadPage(): React.JSX.Element {
  const [importType, setImportType] = useState<ImportType>('PRODUCT_MASTER');
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [detected, setDetected] = useState<{
    sheet: string | null;
    headerRow: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadImport();
  const batches = useImportBatches();

  async function submit(): Promise<void> {
    if (!file) return;
    setError(null);
    setDetected(null);
    try {
      const res = await upload.mutateAsync({
        file,
        importType,
        sheetName: sheetName.trim() || undefined,
      });
      setBatchId(res.batchId);
      setDetected({ sheet: res.sheetName, headerRow: res.headerRowNumber });
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Bulk upload"
        description="Staged, validated import · CSV or XLSX"
        actions={
          <>
            <Link href="/inventory">
              <Button variant="ghost" size="sm">
                Stock overview
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 rounded-lg border border-line bg-panel p-4">
        <div className="mb-3 flex items-center gap-2">
          {(['PRODUCT_MASTER', 'STOCK_LEDGER'] as ImportType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setImportType(t)}
              className={
                'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors ' +
                (importType === t
                  ? 'border-accent bg-canvas text-ink'
                  : 'border-line text-muted hover:text-ink')
              }
            >
              {t === 'PRODUCT_MASTER' ? 'Product master' : 'Stock ledger'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          className={
            'flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 transition-colors ' +
            (dragging ? 'border-accent bg-canvas' : 'border-line')
          }
        >
          <span className="text-[13px] text-text">
            {file ? file.name : 'Drop a .csv or .xlsx file here, or click to choose'}
          </span>
          <span className="mt-1 text-[11px] text-faint">
            Rows are staged and validated in the background — nothing posts until it
            passes.
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="mt-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            Worksheet (optional)
            <input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Leave blank to detect automatically"
              className="rounded-md border border-line bg-panel px-3 py-1.5 text-[13px] text-text outline-none placeholder:text-faint focus:border-accent"
            />
          </label>
          <p className="mt-1 text-[11px] text-faint">
            A workbook usually has several sheets and a title above the real header row;
            both are detected from the columns. Name a sheet here to override.
          </p>
        </div>

        {detected?.sheet && (
          <p className="mt-2 text-[12px] text-emerald-700">
            Read worksheet &ldquo;{detected.sheet}&rdquo; using row {detected.headerRow}{' '}
            as the header.
          </p>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] text-muted">
            Column mapping preview ({EXPECTED_COLUMNS[importType].length} recognised
            columns)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXPECTED_COLUMNS[importType].map((c) => (
              <span
                key={c}
                className="font-numeric rounded border border-line bg-canvas px-1.5 py-0.5 text-[11px] text-muted"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            * required. Header names are matched case- and punctuation-insensitively, and
            common legacy spellings are accepted.
          </p>
        </details>

        {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

        <div className="mt-3 flex justify-end">
          <Button
            variant="accent"
            size="sm"
            disabled={!file || upload.isPending}
            onClick={() => void submit()}
          >
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      {batchId && <BatchProgress batchId={batchId} />}

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
          Recent imports
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas text-left text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Rows</th>
                <th className="px-3 py-2 text-right font-medium">OK</th>
                <th className="px-3 py-2 text-right font-medium">Skipped</th>
                <th className="px-3 py-2 text-right font-medium">Errors</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(batches.data?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted">
                    No imports yet.
                  </td>
                </tr>
              )}
              {(batches.data?.items ?? []).map((b) => (
                <tr key={b.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-3 py-2 text-ink">{b.fileName}</td>
                  <td className="px-3 py-2 text-[12px] text-muted">
                    {b.importType === 'PRODUCT_MASTER' ? 'Products' : 'Ledger'}
                  </td>
                  <td className="px-3 py-2">
                    <Pill variant={batchVariant(b.status)} dot>
                      {batchLabel(b.status)}
                    </Pill>
                  </td>
                  <td className="font-numeric px-3 py-2 text-right text-text">
                    {b.totalRows}
                  </td>
                  <td className="font-numeric px-3 py-2 text-right text-emerald-700">
                    {b.successRows}
                  </td>
                  <td className="font-numeric px-3 py-2 text-right text-amber-700">
                    {b.skippedRows}
                  </td>
                  <td className="font-numeric px-3 py-2 text-right text-red-600">
                    {b.errorRows}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setBatchId(b.id)}
                      className="text-[12px] font-medium text-accent-2 hover:underline"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Live progress + the quarantine queue for one batch. */
function BatchProgress({ batchId }: { batchId: string }): React.JSX.Element {
  const [tab, setTab] = useState<'SKIPPED' | 'ERROR' | null>('SKIPPED');
  const { data } = useImportBatch(batchId, { status: tab });
  const resolve = useResolveImportRow(batchId);
  const reprocess = useReprocessImport(batchId);

  if (!data) return <p className="text-[13px] text-muted">Loading batch…</p>;

  const done = data.totalRows - data.pendingRows;
  const pct = data.totalRows === 0 ? 100 : Math.round((done / data.totalRows) * 100);

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{data.fileName}</h2>
          <p className="font-numeric text-[12px] text-muted">{data.id}</p>
        </div>
        <Pill variant={batchVariant(data.status)} dot>
          {batchLabel(data.status)}
        </Pill>
      </div>

      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-canvas">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <span>
          {done} / {data.totalRows} processed
        </span>
        <span className="text-emerald-700">{data.successRows} created/updated</span>
        <span className="text-amber-700">{data.skippedRows} skipped</span>
        <span className="text-red-600">{data.errorRows} errors</span>
      </div>

      {data.errorMessage && (
        <p className="mb-3 text-[12px] text-red-600">{data.errorMessage}</p>
      )}

      {(data.skippedRows > 0 || data.errorRows > 0) && (
        <>
          <div className="mb-2 flex items-center gap-1 border-b border-line">
            {(['SKIPPED', 'ERROR'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  'border-b-2 px-3 py-1.5 text-[13px] font-medium transition-colors ' +
                  (tab === t
                    ? 'border-accent text-ink'
                    : 'border-transparent text-muted hover:text-ink')
                }
              >
                {t === 'SKIPPED' ? 'Quarantine' : 'Errors'}
                <span className="font-numeric ml-1.5 text-[11px] text-faint">
                  {t === 'SKIPPED' ? data.skippedRows : data.errorRows}
                </span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void openAuthedAsset(`/inventory/bulk-imports/${batchId}/errors.csv`)
                }
                className="text-[12px] font-medium text-accent-2 hover:underline"
              >
                Download error CSV
              </button>
              <Button
                variant="ghost"
                size="sm"
                disabled={reprocess.isPending}
                onClick={() => reprocess.mutate(undefined as never)}
              >
                Re-run pending
              </Button>
            </div>
          </div>

          {tab === 'SKIPPED' && (
            <p className="mb-2 text-[11px] text-faint">
              These rows named a product with no catalogue match. They are never
              auto-created — confirm each is a real SKU first.
            </p>
          )}

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-canvas text-left text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  {tab === 'SKIPPED' && <th className="w-40 px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="font-numeric px-3 py-2 text-muted">{r.rowNumber}</td>
                    <td className="px-3 py-2 text-ink">
                      {String(r.rawData.product_name ?? r.rawData.name ?? '—')}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted">
                      {r.errorMessage ?? '—'}
                    </td>
                    {tab === 'SKIPPED' && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={resolve.isPending}
                          onClick={() =>
                            resolve.mutate({ rowId: r.id, action: 'CREATE_PRODUCT' })
                          }
                          className="text-[12px] font-medium text-accent-2 hover:underline"
                        >
                          Create SKU
                        </button>
                        <button
                          type="button"
                          disabled={resolve.isPending}
                          onClick={() =>
                            resolve.mutate({ rowId: r.id, action: 'DISCARD' })
                          }
                          className="ml-3 text-[12px] text-muted hover:underline"
                        >
                          Discard
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      Nothing in this queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function batchLabel(status: string): string {
  return (
    {
      PROCESSING: 'Processing',
      COMPLETED: 'Completed',
      COMPLETED_WITH_ERRORS: 'Completed with issues',
      FAILED: 'Failed',
    }[status] ?? status
  );
}

function batchVariant(status: string): 'success' | 'danger' | 'warn' | 'info' | 'gray' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'COMPLETED_WITH_ERRORS':
      return 'warn';
    case 'FAILED':
      return 'danger';
    case 'PROCESSING':
      return 'info';
    default:
      return 'gray';
  }
}
