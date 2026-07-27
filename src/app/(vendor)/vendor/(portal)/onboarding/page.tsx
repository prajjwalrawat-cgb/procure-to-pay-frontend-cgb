'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Pill,
} from '@/components/ui';
import {
  VENDOR_CATEGORY_CONFIGS,
  VENDOR_DOCUMENT_TYPE,
  type SaveStepInput,
  type VendorDocumentType,
} from '@/lib/shared';
import { useMemo, useState } from 'react';

import {
  useAcknowledgeCoc,
  useOnboarding,
  useSaveStep,
  useSubmitOnboarding,
  useUploadOnboardingDocFile,
  type UploadedDocResult,
} from '@/vendor/lib/onboarding';
import { useToastStore } from '@/vendor/store/toast-store';

/** Mirrors the API's MIME allow-list (upload-options.ts) so the picker only
 *  offers file types the server will accept. */
const ACCEPTED_DOC_TYPES = '.pdf,.png,.jpg,.jpeg,.tif,.tiff';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STEP_NAMES = [
  'Company basics',
  'Statutory identity',
  'Banking',
  'Certifications',
  'Capabilities',
  'Ownership & UBO',
];

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}): React.JSX.Element {
  return (
    <div>
      <label className="text-muted mb-1 block text-[12px] font-medium">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function OnboardingWizardPage(): React.JSX.Element {
  const { data, isLoading, error } = useOnboarding();
  const saveStep = useSaveStep();
  const uploadDoc = useUploadOnboardingDocFile();
  const ackCoc = useAcknowledgeCoc();
  const submit = useSubmitOnboarding();
  const toast = useToastStore((s) => s.push);

  const [step, setStep] = useState(1);
  // Step field state (flat; only the fields we send per step).
  const [f, setF] = useState<Record<string, string>>({});
  const [isMsme, setIsMsme] = useState(false);
  const [isRelatedParty, setIsRelatedParty] = useState(false);
  const [cocName, setCocName] = useState('');
  const [cocDesignation, setCocDesignation] = useState('');
  const [cocAgreed, setCocAgreed] = useState(false);
  // Locally-uploaded docs give instant feedback; the server list is the source
  // of truth once the resume query refetches, so ticks survive a refresh.
  const [localDocs, setLocalDocs] = useState<Map<string, UploadedDocResult>>(
    () => new Map(),
  );
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [showOtherDocs, setShowOtherDocs] = useState(false);

  const uploadedDocs = useMemo(() => {
    const merged = new Map<string, UploadedDocResult>();
    // documents arrive newest-first, so the first entry per type is current.
    for (const d of data?.documents ?? []) {
      if (!merged.has(d.docType)) {
        merged.set(d.docType, {
          id: d.id,
          s3Key: '',
          filename: d.filename,
          sizeBytes: d.sizeBytes,
          url: d.url,
        });
      }
    }
    for (const [k, v] of localDocs) merged.set(k, v);
    return merged;
  }, [data, localDocs]);

  if (isLoading) return <p className="text-muted p-6 text-[13px]">Loading…</p>;
  if (error || !data)
    return (
      <div className="p-6">
        <p className="text-muted text-[13px]">
          No onboarding in progress for this account.
        </p>
      </div>
    );

  const set = (k: string) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));
  const completionPct = data.wizardState?.completionPct ?? 0;

  const persist = (stepNumber: number, payload: SaveStepInput): void => {
    saveStep.mutate(
      { stepNumber, data: payload },
      {
        onSuccess: () => {
          toast(`Step ${stepNumber} saved`, 'success');
          setStep(Math.min(6, stepNumber + 1));
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const saveCurrent = (): void => {
    if (step === 1) {
      persist(1, {
        legalEntityType: 'PVT_LTD',
        legalEntityName: f.legalEntityName ?? '',
        businessPan: f.businessPan ?? '',
        addressLine1: f.addressLine1 ?? '',
        city: f.city ?? '',
        stateCode: f.stateCode ?? '',
        pincode: f.pincode ?? '',
        primaryContactName: f.primaryContactName ?? '',
        primaryContactEmail: f.primaryContactEmail ?? '',
        primaryContactPhone: f.primaryContactPhone ?? '',
      } as SaveStepInput);
    } else if (step === 2) {
      persist(2, {
        gstin: f.gstin ?? '',
        isMsme,
        udyamNumber: isMsme ? (f.udyamNumber ?? null) : null,
      } as SaveStepInput);
    } else if (step === 3) {
      persist(3, {
        bankName: f.bankName ?? '',
        accountNumber: f.accountNumber ?? '',
        ifsc: f.ifsc ?? '',
        holderName: f.holderName ?? '',
      } as SaveStepInput);
    } else if (step === 4) {
      persist(4, { certifications: [] } as SaveStepInput);
    } else if (step === 5) {
      persist(5, {
        categoryTags: (f.categoryTags ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        capabilityTags: (f.capabilityTags ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        facilities: [],
        employeeCountBracket: '10-50',
        annualTurnoverDeclared: f.annualTurnoverDeclared || null,
        references: [],
      } as SaveStepInput);
    } else if (step === 6) {
      persist(6, {
        beneficialOwners: [],
        sanctionsSelfDeclaration: true,
        isRelatedParty,
        relatedPartyDisclosure: isRelatedParty
          ? (f.relatedPartyDisclosure ?? null)
          : null,
      } as SaveStepInput);
    }
  };

  const uploadStatutoryDoc = (docType: VendorDocumentType, file: File): void => {
    setUploadingDoc(docType);
    uploadDoc.mutate(
      { docType, file },
      {
        onSuccess: (res) => {
          setLocalDocs((prev) => new Map(prev).set(docType, res));
          toast(`${docType.replace(/_/g, ' ')} uploaded`, 'success');
        },
        onError: (e) => toast(e.message, 'error'),
        onSettled: () => setUploadingDoc(null),
      },
    );
  };

  /** One file picker per document type, plus a View link once uploaded so the
   *  vendor can confirm the right file went up. The hidden input is driven by
   *  the label, so the row stays keyboard-accessible without a custom widget. */
  const renderDocButton = (d: VendorDocumentType): React.JSX.Element => {
    const done = uploadedDocs.get(d);
    const busy = uploadingDoc === d;
    const label = d.replace(/_/g, ' ');
    return (
      <div
        key={d}
        className={`border-border flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors ${
          done ? 'border-brand/40 bg-brand/5' : ''
        } ${busy ? 'opacity-60' : ''}`}
      >
        <label className={busy ? 'pointer-events-none' : 'cursor-pointer'}>
          <input
            type="file"
            className="sr-only"
            accept={ACCEPTED_DOC_TYPES}
            disabled={uploadDoc.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset so re-picking the same file still fires onChange.
              e.target.value = '';
              if (file) uploadStatutoryDoc(d, file);
            }}
          />
          <span className="font-medium hover:underline">
            {done ? '✓ ' : ''}
            {label}
          </span>
        </label>
        {busy && <span className="text-muted">uploading…</span>}
        {done && (
          <>
            <span className="text-muted max-w-[180px] truncate text-[12px]">
              {done.filename} · {formatBytes(done.sizeBytes)}
            </span>
            {done.url && (
              <a
                href={done.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand text-[12px] font-medium hover:underline"
              >
                View
              </a>
            )}
          </>
        )}
      </div>
    );
  };

  // Documents the invited vendor's category actually requires (from the config
  // keyed on the onboarding's categoryKey). Everything else is offered behind a
  // toggle so the common case shows only the handful that matter.
  const categoryCfg = VENDOR_CATEGORY_CONFIGS.find(
    (c) => c.categoryKey === data?.categoryKey,
  );
  const requiredDocs = categoryCfg?.requiredDocuments ?? [];
  const otherDocs = VENDOR_DOCUMENT_TYPE.filter((d) => !requiredDocs.includes(d));

  const acknowledge = (): void => {
    if (!cocAgreed) {
      toast('You must accept the code of conduct', 'error');
      return;
    }
    ackCoc.mutate(
      { name: cocName, designation: cocDesignation },
      {
        onSuccess: () => toast('Code of conduct acknowledged', 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const doSubmit = (): void => {
    submit.mutate(undefined, {
      onSuccess: () => toast('Onboarding submitted for review', 'success'),
      onError: (e) => toast(e.message, 'error'),
    });
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-4">
        <h1 className="text-ink text-[20px] font-semibold">Vendor onboarding</h1>
        <p className="text-muted text-[13px]">
          Complete all steps, acknowledge the code of conduct, then submit.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="bg-canvas h-1.5 w-48 overflow-hidden rounded-full">
            <div className="bg-brand h-full" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="text-muted text-[12px] tabular-nums">
            {completionPct}% complete
          </span>
        </div>
      </div>

      {/* Step tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {STEP_NAMES.map((name, i) => {
          const n = i + 1;
          const done = data.wizardState?.steps?.[`step${n}`]?.done;
          return (
            <button
              key={n}
              onClick={() => setStep(n)}
              className={`rounded-md px-2.5 py-1 text-[12px] ${
                step === n ? 'bg-ink text-white' : done ? 'text-accent-2' : 'text-muted'
              }`}
            >
              {n}. {name}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Step {step}: {STEP_NAMES[step - 1]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {step === 1 && (
            <>
              <Field
                label="Legal entity name"
                value={f.legalEntityName ?? ''}
                onChange={set('legalEntityName')}
              />
              <Field
                label="Business PAN"
                value={f.businessPan ?? ''}
                onChange={set('businessPan')}
                placeholder="AAAAA0000A"
              />
              <Field
                label="Address"
                value={f.addressLine1 ?? ''}
                onChange={set('addressLine1')}
              />
              <div className="grid grid-cols-3 gap-2">
                <Field label="City" value={f.city ?? ''} onChange={set('city')} />
                <Field
                  label="State code"
                  value={f.stateCode ?? ''}
                  onChange={set('stateCode')}
                  placeholder="AS"
                />
                <Field
                  label="Pincode"
                  value={f.pincode ?? ''}
                  onChange={set('pincode')}
                />
              </div>
              <Field
                label="Contact name"
                value={f.primaryContactName ?? ''}
                onChange={set('primaryContactName')}
              />
              <Field
                label="Contact email"
                type="email"
                value={f.primaryContactEmail ?? ''}
                onChange={set('primaryContactEmail')}
              />
              <Field
                label="Contact phone"
                value={f.primaryContactPhone ?? ''}
                onChange={set('primaryContactPhone')}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label="GSTIN"
                value={f.gstin ?? ''}
                onChange={set('gstin')}
                placeholder="18AAACG3030G1Z3"
              />
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={isMsme}
                  onChange={(e) => setIsMsme(e.target.checked)}
                />
                Registered MSME
              </label>
              {isMsme && (
                <Field
                  label="Udyam number"
                  value={f.udyamNumber ?? ''}
                  onChange={set('udyamNumber')}
                />
              )}
              <p className="text-muted text-[12px]">
                GSTIN & PAN are auto-verified against mock government APIs on save.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <Field
                label="Bank name"
                value={f.bankName ?? ''}
                onChange={set('bankName')}
              />
              <Field
                label="Account number"
                value={f.accountNumber ?? ''}
                onChange={set('accountNumber')}
              />
              <Field
                label="IFSC"
                value={f.ifsc ?? ''}
                onChange={set('ifsc')}
                placeholder="HDFC0001234"
              />
              <Field
                label="Account holder name"
                value={f.holderName ?? ''}
                onChange={set('holderName')}
              />
              <p className="text-muted text-[12px]">
                A penny-drop name match runs automatically on save.
              </p>
            </>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {requiredDocs.length > 0 ? (
                <div>
                  <p className="text-muted mb-2 text-[13px]">
                    Required documents{categoryCfg ? ` for ${categoryCfg.displayName}` : ''}{' '}
                    — select a file for each (PDF or image, max 10 MB):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {requiredDocs.map((d) => renderDocButton(d))}
                  </div>
                </div>
              ) : (
                <p className="text-muted text-[13px]">
                  Upload your documents (PDF or image, max 10 MB):
                </p>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowOtherDocs((v) => !v)}
                  className="text-brand text-[12px] font-medium hover:underline"
                >
                  {showOtherDocs ? '− Hide other documents' : '+ Add other documents'}
                </button>
                {showOtherDocs && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherDocs.map((d) => renderDocButton(d))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <>
              <Field
                label="Category tags (comma-separated)"
                value={f.categoryTags ?? ''}
                onChange={set('categoryTags')}
                placeholder="spares, castings"
              />
              <Field
                label="Capability tags (comma-separated)"
                value={f.capabilityTags ?? ''}
                onChange={set('capabilityTags')}
                placeholder="machining"
              />
              <Field
                label="Annual turnover (₹)"
                value={f.annualTurnoverDeclared ?? ''}
                onChange={set('annualTurnoverDeclared')}
                placeholder="25000000"
              />
            </>
          )}

          {step === 6 && (
            <>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={isRelatedParty}
                  onChange={(e) => setIsRelatedParty(e.target.checked)}
                />
                We are a related party to the buyer
              </label>
              {isRelatedParty && (
                <Field
                  label="Related-party disclosure"
                  value={f.relatedPartyDisclosure ?? ''}
                  onChange={set('relatedPartyDisclosure')}
                />
              )}
              <p className="text-muted text-[12px]">
                By saving this step you self-declare no sanctions exposure. Sanctions
                screening runs automatically.
              </p>

              {/* CoC + submit */}
              <div className="border-line mt-4 space-y-3 border-t pt-4">
                <CardTitle>Code of conduct</CardTitle>
                <Field label="Your name" value={cocName} onChange={setCocName} />
                <Field
                  label="Designation"
                  value={cocDesignation}
                  onChange={setCocDesignation}
                />
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={cocAgreed}
                    onChange={(e) => setCocAgreed(e.target.checked)}
                  />
                  I have read and accept the supplier code of conduct
                </label>
                <Button
                  variant="default"
                  onClick={acknowledge}
                  disabled={ackCoc.isPending}
                >
                  Acknowledge CoC
                </Button>
              </div>
            </>
          )}

          <div className="border-line mt-4 flex justify-between border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={saveCurrent}
                disabled={saveStep.isPending}
              >
                Save step
              </Button>
              {step === 6 && (
                <Button variant="accent" onClick={doSubmit} disabled={submit.isPending}>
                  Submit for review
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {completionPct === 100 && (
        <p className="text-accent-2 mt-3 text-[13px]">
          <Pill variant="success">Ready</Pill> All steps complete — acknowledge the CoC
          and submit.
        </p>
      )}
    </div>
  );
}
