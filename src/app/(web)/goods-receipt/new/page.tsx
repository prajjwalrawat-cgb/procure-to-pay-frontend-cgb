'use client';

import {
  Button,
  PageHeader,
  StepIndicator,
  controlClass,
} from '@/components/ui';
import type { GrnCreateInput } from '@/lib/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { usePurchaseOrder, usePurchaseOrders } from '@/lib/api/purchase-orders';
import { useCreateReceipt } from '@/lib/api/receipts';
import { useToastStore } from '@/store/toast-store';
import { formatDate } from '@/lib/format';

const STEPS = ['Gate entry', 'Line receipt', 'Attachments', 'Review'];
// One definition for every text field, select and date input on this page —
// see components/ui/components/input.tsx.
const inputCls = controlClass;

interface LineDraft {
  poLineId: string;
  itemDesc: string;
  uom: string;
  qtyOrdered: string;
  qtyRemaining: string;
  qtyReceived: string;
  batchNumber: string;
  storageLocation: string;
}

// useSearchParams() bails the page out of static rendering, so the search-param
// consumer must sit under a Suspense boundary (Next 14 requirement) — else
// `next build` fails prerendering this route.
export default function NewReceiptPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-muted">Loading…</div>}>
      <NewReceiptForm />
    </Suspense>
  );
}

function NewReceiptForm(): React.JSX.Element {
  const params = useSearchParams();
  const router = useRouter();
  const push = useToastStore((s) => s.push);
  const preselected = params.get('po') ?? '';

  const [poId, setPoId] = useState(preselected);
  const [step, setStep] = useState(0);
  const create = useCreateReceipt();

  const pendingPos = usePurchaseOrders('awaiting_grn');
  const poDetail = usePurchaseOrder(poId);

  // Gate fields
  const [gateEntryRef, setGateEntryRef] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhoneLast4, setDriverPhoneLast4] = useState('');
  const [transporter, setTransporter] = useState('');
  const [packingCondition, setPackingCondition] =
    useState<GrnCreateInput['packingCondition']>('OK');
  const [grossWeightKg, setGrossWeightKg] = useState('');
  const [tareWeightKg, setTareWeightKg] = useState('');
  const [unloadingLocation, setUnloadingLocation] = useState('Dock-1');

  const [lines, setLines] = useState<LineDraft[]>([]);

  // Populate line drafts when a PO is chosen.
  const poLines = poDetail.data?.lines ?? [];
  useMemo(() => {
    if (poLines.length > 0 && lines.length === 0) {
      setLines(
        poLines.map((l) => {
          const remaining = Math.max(0, Number(l.qtyOrdered) - Number(l.qtyReceived));
          return {
            poLineId: l.id,
            itemDesc: l.itemDesc,
            uom: l.uom,
            qtyOrdered: l.qtyOrdered,
            qtyRemaining: String(remaining),
            qtyReceived: '',
            batchNumber: '',
            storageLocation: 'Yard-A',
          };
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poLines.length]);

  const netWeight =
    grossWeightKg && tareWeightKg
      ? (Number(grossWeightKg) - Number(tareWeightKg)).toFixed(0)
      : '';

  const step1Valid = !!poId && !!gateEntryRef && !!vehicleNo;
  const step2Valid = lines.some((l) => Number(l.qtyReceived) > 0);

  function setLine(idx: number, patch: Partial<LineDraft>): void {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function buildBody(submit: boolean): GrnCreateInput {
    return {
      poId,
      receiptType: 'PARTIAL',
      gateEntryRef,
      vehicleNo,
      driverName: driverName || null,
      driverPhoneLast4: driverPhoneLast4 || null,
      transporter: transporter || null,
      packingCondition,
      unloadingLocation,
      grossWeightKg: grossWeightKg || null,
      tareWeightKg: tareWeightKg || null,
      returnFreightBorneBy: 'VENDOR',
      submit,
      lines: lines
        .filter((l) => Number(l.qtyReceived) > 0)
        .map((l) => ({
          poLineId: l.poLineId,
          qtyReceived: l.qtyReceived,
          uomReceived: l.uom,
          batchNumber: l.batchNumber || null,
          serialNumbers: [],
          storageLocation: l.storageLocation || null,
        })),
    };
  }

  function onSave(submit: boolean): void {
    create.mutate(buildBody(submit), {
      onSuccess: (res) => {
        push(submit ? 'Receipt sent for QC' : 'Draft receipt saved', 'success');
        router.push(`/goods-receipt/${res.id}`);
      },
      onError: (e) => push((e as Error).message, 'error'),
    });
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New goods receipt"
        description="Gate-to-post receipt"
      />

      <StepIndicator steps={STEPS} current={step} className="mb-6" />

      <div className="rounded-lg border border-line bg-panel p-5">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Purchase order">
              <select
                className={inputCls}
                value={poId}
                onChange={(e) => {
                  setPoId(e.target.value);
                  setLines([]);
                }}
              >
                <option value="">Select an issued PO…</option>
                {pendingPos.data?.items.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.number} — {po.vendor.name}
                  </option>
                ))}
              </select>
            </Field>
            {poDetail.data?.vendor && (
              <p className="text-[12px] text-muted">
                Vendor: <span className="text-text">{poDetail.data.vendor.name}</span> ,
                Expected{' '}
                {poDetail.data.expectedDeliveryDate
                  ? formatDate(poDetail.data.expectedDeliveryDate)
                  : '—'}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gate entry / challan ref">
                <input
                  className={inputCls}
                  value={gateEntryRef}
                  onChange={(e) => setGateEntryRef(e.target.value)}
                />
              </Field>
              <Field label="Vehicle no">
                <input
                  className={inputCls}
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                />
              </Field>
              <Field label="Driver name">
                <input
                  className={inputCls}
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </Field>
              <Field label="Driver phone (last 4)">
                <input
                  className={inputCls}
                  maxLength={4}
                  value={driverPhoneLast4}
                  onChange={(e) => setDriverPhoneLast4(e.target.value)}
                />
              </Field>
              <Field label="Transporter">
                <input
                  className={inputCls}
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                />
              </Field>
              <Field label="Unloading location">
                <input
                  className={inputCls}
                  value={unloadingLocation}
                  onChange={(e) => setUnloadingLocation(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Packing condition">
              <select
                className={inputCls}
                value={packingCondition}
                onChange={(e) =>
                  setPackingCondition(
                    e.target.value as GrnCreateInput['packingCondition'],
                  )
                }
              >
                <option value="OK">OK</option>
                <option value="DAMAGED_PACKING">Damaged packing</option>
                <option value="WET">Wet</option>
                <option value="TAMPERED">Tampered</option>
              </select>
            </Field>
            {packingCondition !== 'OK' && (
              <div className="rounded-sm bg-warn-wash px-3 py-2 text-[12px] text-warn">
                QC will be mandatory even for tolerance-auto-accept items.
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Weighbridge gross (kg)">
                <input
                  className={inputCls}
                  value={grossWeightKg}
                  onChange={(e) => setGrossWeightKg(e.target.value)}
                />
              </Field>
              <Field label="Tare (kg)">
                <input
                  className={inputCls}
                  value={tareWeightKg}
                  onChange={(e) => setTareWeightKg(e.target.value)}
                />
              </Field>
              <Field label="Net (kg)">
                <input className={inputCls + ' bg-canvas'} value={netWeight} readOnly />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={l.poLineId} className="rounded-md border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-text">{l.itemDesc}</span>
                  <span className="font-numeric text-[11px] text-faint">
                    ordered {l.qtyOrdered}, remaining {l.qtyRemaining} {l.uom}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label={`Qty received (${l.uom})`}>
                    <input
                      className={inputCls}
                      value={l.qtyReceived}
                      onChange={(e) => setLine(i, { qtyReceived: e.target.value })}
                    />
                  </Field>
                  <Field label="Batch / lot">
                    <input
                      className={inputCls}
                      value={l.batchNumber}
                      onChange={(e) => setLine(i, { batchNumber: e.target.value })}
                    />
                  </Field>
                  <Field label="Storage location">
                    <input
                      className={inputCls}
                      value={l.storageLocation}
                      onChange={(e) => setLine(i, { storageLocation: e.target.value })}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  className="mt-2 text-[11px] text-accent-2 hover:underline"
                  onClick={() => setLine(i, { qtyReceived: l.qtyRemaining })}
                >
                  Copy remaining from PO
                </button>
              </div>
            ))}
            {lines.length === 0 && (
              <p className="text-[13px] text-muted">Select a PO in step 1 first.</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">
              Attach the delivery challan, invoice copy, COA and packing/damage photos
              after saving. Attachments upload to the receipt once created.
            </p>
            <div className="rounded-sm bg-canvas px-3 py-6 text-center text-[12px] text-faint">
              Attachment upload is available on the receipt detail page after saving.
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-[13px]">
            <Row k="Purchase order" v={poDetail.data?.number ?? poId} />
            <Row k="Vendor" v={poDetail.data?.vendor.name ?? '—'} />
            <Row k="Gate entry" v={gateEntryRef} />
            <Row k="Vehicle" v={vehicleNo} />
            <Row k="Packing" v={packingCondition} />
            <Row k="Weighbridge net" v={netWeight ? `${netWeight} kg` : '—'} />
            <div className="mt-2 border-t border-line pt-2">
              {lines
                .filter((l) => Number(l.qtyReceived) > 0)
                .map((l) => (
                  <Row
                    key={l.poLineId}
                    k={l.itemDesc}
                    v={`${l.qtyReceived} ${l.uom}, ${l.batchNumber || 'no batch'}`}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (step === 0 ? router.back() : setStep(step - 1))}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <div className="flex gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button
                variant="default"
                size="sm"
                disabled={create.isPending || !step2Valid}
                onClick={() => onSave(false)}
              >
                Save as draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={create.isPending || !step2Valid}
                onClick={() => onSave(true)}
              >
                Send for QC
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={(step === 0 && !step1Valid) || (step === 1 && !step2Valid)}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }): React.JSX.Element {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{k}</span>
      <span className="font-numeric text-text">{v}</span>
    </div>
  );
}
