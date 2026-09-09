'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Pill,
} from '@/components/ui';
import {
  LEGAL_ENTITY_TYPE,
  ONBOARDING_OPTIONAL_DOCUMENTS,
  ONBOARDING_STEP1_DOCUMENTS,
  ONBOARDING_STEP4_DOCUMENTS,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_STEP_NAMES,
  ONBOARDING_STEP_SCHEMAS,
  SELECTABLE_GST_STATES,
  VENDOR_DOCUMENT_TYPE,
  fieldSourceLabel,
  gstStateName,
  vendorDocumentLabel,
  type DocumentExtractionResult,
  type ExtractedField,
  type ExtractedFieldMap,
  type SaveStepInput,
  type VendorDocumentType,
} from '@/lib/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, zodFieldErrors, zodSummary } from '@/lib/api-error';
import {
  applyExtractedFields,
  hydrateWizardForm,
  lookupIfsc,
  useCategoryOptions,
  useOnboarding,
  useSaveStep,
  useSubmitOnboarding,
  useUploadOnboardingDocFile,
  type ResumeResponse,
  type UploadedDocResult,
} from '@/vendor/lib/onboarding';
import { useToastStore } from '@/vendor/store/toast-store';

/** Mirrors the API's MIME allow-list (upload-options.ts) so the picker only
 *  offers file types the server will accept. */
const ACCEPTED_DOC_TYPES = '.pdf,.png,.jpg,.jpeg,.tif,.tiff';

/** Documents the API parses on upload (VendorKycService.isExtractable) — the
 *  ones worth saying "reading…" over rather than "uploading…". */
const EXTRACTED_DOCUMENTS: VendorDocumentType[] = [
  ...ONBOARDING_STEP1_DOCUMENTS,
  'CANCELLED_CHEQUE',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  PROPRIETORSHIP: 'Proprietorship',
  PARTNERSHIP: 'Partnership firm',
  LLP: 'LLP',
  PVT_LTD: 'Private limited',
  PUBLIC_LTD: 'Public limited',
  HUF: 'HUF',
  TRUST: 'Trust',
  SOCIETY: 'Society / AOP',
  INDIVIDUAL: 'Individual',
};

/**
 * The badge that tells a vendor where a pre-filled value came from.
 *
 * Green means something outside the document they uploaded agreed with it — the
 * GSTN lookup, or a derivation from the GSTIN's own check digit — and the input
 * is locked, because the whole point of verifying a value is that it can no
 * longer be fat-fingered into a typo. Amber means it was read off the page and
 * nothing has confirmed it: shown, editable, and asking to be checked.
 */
function SourceBadge({ field }: { field: ExtractedField }): React.JSX.Element {
  return (
    <Pill variant={field.verified ? 'success' : 'warn'} dot>
      {fieldSourceLabel(field.source)}
      {field.verified ? '' : ' — please confirm'}
    </Pill>
  );
}

/**
 * What an upload had to say — blocking problems in red, things to look at in
 * amber. Shown next to the pickers for exactly the documents named in `forDocs`,
 * so the reason an upload was rejected outlives the toast, and a note about the
 * PAN card never appears over the banking step. Each note names its document,
 * because two of them can be on screen at once.
 */
function ExtractionNotes({
  results,
  forDocs,
}: {
  results: Map<string, DocumentExtractionResult>;
  forDocs: VendorDocumentType[];
}): React.JSX.Element | null {
  const relevant = forDocs
    .map((d) => results.get(d))
    .filter((r): r is DocumentExtractionResult => !!r)
    .filter((r) => r.errors.length > 0 || r.warnings.length > 0);
  if (relevant.length === 0) return null;
  const prefix = (r: DocumentExtractionResult): string =>
    relevant.length > 1 || forDocs.length > 1
      ? `${vendorDocumentLabel(r.docType)}: `
      : '';
  return (
    <>
      {relevant.map((r) => (
        <div key={r.docType}>
          {r.errors.map((e) => (
            <p key={e} className="mt-2 text-[12px] text-danger">
              <span className="capitalize">{prefix(r)}</span>
              {e}
            </p>
          ))}
          {r.warnings.map((w) => (
            <p key={w} className="mt-2 text-[12px] text-warn">
              <span className="capitalize">{prefix(r)}</span>
              {w}
            </p>
          ))}
        </div>
      ))}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  hint,
  provenance,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  /** Why the field was rejected — shown under the input, in red. */
  error?: string;
  /** Always-on guidance for fields whose format isn't obvious (PAN, state code). */
  hint?: string;
  /** Where this value came from, when it was not typed by the vendor. */
  provenance?: ExtractedField | null;
}): React.JSX.Element {
  const locked = provenance?.verified === true;
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="block text-[12px] font-medium text-muted">{label}</label>
        {provenance && <SourceBadge field={provenance} />}
      </div>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        readOnly={locked}
        className={locked ? 'cursor-not-allowed bg-canvas text-muted' : undefined}
      />
      {error ? (
        <p className="mt-1 text-[12px] text-danger">{error}</p>
      ) : locked ? (
        <p className="mt-1 text-[12px] text-faint">
          Taken from your documents and verified — to change it, upload a corrected
          document or ask your buyer to raise a change request.
        </p>
      ) : (
        hint && <p className="mt-1 text-[12px] text-faint">{hint}</p>
      )}
    </div>
  );
}

/**
 * State picker. The stored value is the 2-digit GST code — it drives CGST+SGST
 * vs IGST in determineTaxKind — but a vendor knows their state by name, so the
 * list is labelled "Delhi (07)" and sorted alphabetically.
 */
function StateCodeField({
  value,
  onChange,
  error,
  provenance,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  provenance?: ExtractedField | null;
}): React.JSX.Element {
  const options = useMemo(
    () => [...SELECTABLE_GST_STATES].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  // A saved record may carry a retired code (25, 28). Keep it selected and
  // labelled rather than silently resetting the field to blank on load.
  const isRetired = !!value && !options.some((s) => s.code === value);
  const locked = provenance?.verified === true;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="block text-[12px] font-medium text-muted">State</label>
        {provenance && <SourceBadge field={provenance} />}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        disabled={locked}
        className={`h-9 w-full rounded-sm border border-line bg-panel px-2 text-[13px] text-text ${
          error ? 'border-danger' : ''
        } ${locked ? 'cursor-not-allowed bg-canvas text-muted' : ''}`}
      >
        <option value="">Select state…</option>
        {isRetired && (
          <option value={value}>
            {gstStateName(value) ?? value} ({value})
          </option>
        )}
        {options.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name} ({s.code})
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  );
}

/** Constitution of business. Pre-filled from the GST certificate where GSTN
 *  states it, and only locked when GSTN is what stated it — the PAN-derived
 *  guess cannot tell an LLP from a partnership firm, so it stays a suggestion. */
function EntityTypeField({
  value,
  onChange,
  error,
  provenance,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  provenance?: ExtractedField | null;
}): React.JSX.Element {
  const locked = provenance?.verified === true;
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="block text-[12px] font-medium text-muted">Type of entity</label>
        {provenance && <SourceBadge field={provenance} />}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        disabled={locked}
        className={`h-9 w-full rounded-sm border border-line bg-panel px-2 text-[13px] text-text ${
          error ? 'border-danger' : ''
        } ${locked ? 'cursor-not-allowed bg-canvas text-muted' : ''}`}
      >
        <option value="">Select…</option>
        {LEGAL_ENTITY_TYPE.map((t) => (
          <option key={t} value={t}>
            {ENTITY_TYPE_LABELS[t] ?? t}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  );
}

/**
 * The fields each step writes, so the wizard can tell a step whose inputs have
 * moved since the last save from one that is already stored. Mirrors the step
 * payloads assembled in `payloadFor` — a field added there belongs here too, or
 * an edit to it will not count as unsaved.
 */
const STEP_FIELDS: Record<number, string[]> = {
  1: [
    'legalEntityType',
    'legalEntityName',
    'tradeName',
    'businessPan',
    'addressLine1',
    'city',
    'stateCode',
    'pincode',
    'primaryContactName',
    'primaryContactEmail',
    'primaryContactPhone',
  ],
  2: ['gstin', 'udyamNumber'],
  3: ['bankName', 'accountNumber', 'ifsc', 'holderName'],
  // Step 4 sends a constant, not fields — there is nothing on it to leave unsaved.
  4: [],
};

/** The banner for a wizard that is no longer the vendor's to act on — approved,
 *  awaiting a reviewer, or handed back for more information. */
function onboardingStatus(data: ResumeResponse): {
  pill: string;
  title: string;
  body: string;
  tone: 'success' | 'info';
} | null {
  if (data.lifecycleStatus === 'ACTIVE') {
    return {
      pill: 'Approved',
      title: 'Your account is approved and active',
      body:
        'Onboarding is complete — you can receive purchase orders and submit invoices. ' +
        'To change these details, contact your buyer to raise a change request.',
      tone: 'success',
    };
  }
  if (data.reviewDecision === 'RETURNED_FOR_INFO') {
    return {
      pill: 'Action needed',
      title: 'Your buyer needs more information',
      body: 'Update the details below and submit again.',
      tone: 'info',
    };
  }
  if (data.submittedAt) {
    const on = new Date(data.submittedAt).toLocaleDateString('en-IN');
    return {
      pill: 'Under review',
      title: `Submitted on ${on} — awaiting your buyer's review`,
      body:
        'Nothing more to do for now — your answers and documents are locked while ' +
        'your buyer reads them. We will email you when a decision is made.',
      tone: 'info',
    };
  }
  return null;
}

export default function OnboardingWizardPage(): React.JSX.Element {
  const { data, isLoading, error } = useOnboarding();
  // The buyer's own category list — what documents this vendor's category
  // expects is their configuration, not a constant.
  const { data: categoryOptions } = useCategoryOptions();
  const saveStep = useSaveStep();
  const uploadDoc = useUploadOnboardingDocFile();
  const submit = useSubmitOnboarding();
  const toast = useToastStore((s) => s.push);

  const [step, setStep] = useState(1);
  // Step field state (flat; only the fields we send per step).
  const [f, setF] = useState<Record<string, string>>({});
  // Per-field rejection reasons for the current step, keyed by field name.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Where each auto-filled value came from — drives the badges and the locking.
  const [extracted, setExtracted] = useState<ExtractedFieldMap>({});
  const [isMsme, setIsMsme] = useState(false);
  // Locally-uploaded docs give instant feedback; the server list is the source
  // of truth once the resume query refetches, so ticks survive a refresh.
  const [localDocs, setLocalDocs] = useState<Map<string, UploadedDocResult>>(
    () => new Map(),
  );
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [showOtherDocs, setShowOtherDocs] = useState(false);
  /** What each parsed upload yielded, keyed by document type. Keyed rather than
   *  single-slot because the notes are shown beside the pickers on three
   *  different steps, and a warning about the PAN card has no business
   *  appearing over the banking step. */
  const [extractionNotes, setExtractionNotes] = useState<
    Map<string, DocumentExtractionResult>
  >(() => new Map());
  /** Bank + branch for the IFSC currently typed, or null while unresolved. */
  const [bankFromIfsc, setBankFromIfsc] = useState<{
    bank: string;
    branch: string | null;
  } | null>(null);

  /** What the server last confirmed it holds — the yardstick for "unsaved".
   *  Seeded with the form and moved forward by each successful step save. */
  const [savedFields, setSavedFields] = useState<Record<string, string>>({});
  const [savedIsMsme, setSavedIsMsme] = useState(false);

  // Seed the inputs from what the server already holds. Done once per
  // onboarding, not on every refetch: saving a step invalidates this query, and
  // re-seeding then would overwrite whatever the vendor has since typed.
  const seededFor = useRef<string | null>(null);
  const onboardingId = data?.onboardingId ?? null;
  useEffect(() => {
    if (!onboardingId || seededFor.current === onboardingId) return;
    seededFor.current = onboardingId;
    const hydrated = hydrateWizardForm(data?.wizardState);
    setF(hydrated.fields);
    setIsMsme(hydrated.isMsme);
    setSavedFields(hydrated.fields);
    setSavedIsMsme(hydrated.isMsme);
    setExtracted(data?.wizardState?.extracted ?? {});
  }, [onboardingId, data?.wizardState]);

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

  /**
   * Steps whose inputs have moved since they were last saved.
   *
   * The wizard keeps typing in page state, so switching steps never loses it —
   * but Save step is what sends it, and nothing said so. A vendor who edited
   * step 1, walked to step 4 and pressed Submit for review submitted the values
   * from before the edit, with a success toast and no hint that what they had
   * typed had gone nowhere. This is what Submit flushes first, and what the
   * unsaved markers are drawn from.
   */
  const dirtySteps = useMemo(
    () =>
      Object.keys(STEP_FIELDS)
        .map(Number)
        .filter(
          (n) =>
            STEP_FIELDS[n]?.some(
              (k) => (f[k] ?? '').trim() !== (savedFields[k] ?? '').trim(),
            ) ||
            (n === 2 && isMsme !== savedIsMsme),
        ),
    [f, savedFields, isMsme, savedIsMsme],
  );

  /** Nothing typed is lost to a closed tab either — the browser's own prompt is
   *  the only thing that can interrupt a navigation away from the page. */
  useEffect(() => {
    if (dirtySteps.length === 0) return;
    const warn = (e: BeforeUnloadEvent): void => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtySteps.length]);

  // The bank follows from the IFSC, so it is looked up as the vendor types
  // rather than asked for. A code the directory does not know clears the field
  // and the vendor is asked for the name — the only case where they type it.
  useEffect(() => {
    const code = (f.ifsc ?? '').trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      setBankFromIfsc(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void lookupIfsc(code)
        .then((r) => {
          if (!cancelled) setBankFromIfsc(r ? { bank: r.bank, branch: r.branch } : null);
        })
        .catch(() => {
          if (!cancelled) setBankFromIfsc(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [f.ifsc]);

  if (isLoading) return <p className="p-6 text-[13px] text-muted">Loading…</p>;
  if (error || !data)
    return (
      <div className="p-6">
        <p className="text-[13px] text-muted">
          No onboarding in progress for this account.
        </p>
      </div>
    );

  const set =
    (k: string) =>
    (v: string): void => {
      setF((prev) => ({ ...prev, [k]: v }));
      // Editing a rejected field clears its error — keeping it would keep the
      // input red while the user is fixing exactly what it complained about.
      setFieldErrors((prev) => {
        if (!prev[k]) return prev;
        const { [k]: _removed, ...rest } = prev;
        return rest;
      });
    };
  const completionPct = data.wizardState?.completionPct ?? 0;
  // The server decides whether this onboarding may still be changed; the page
  // only renders that decision. Approved vendors and submissions awaiting a
  // reviewer are read-only — re-submitting an approved vendor would drop them
  // out of ACTIVE and block new purchase orders against them.
  const editable = data.editable;
  const status = onboardingStatus(data);
  /**
   * The badge for a field — but only while the box still holds the value it
   * describes. A vendor who edits an unverified suggestion has made the value
   * theirs, and leaving "from document" over their own typing claims a
   * provenance the text no longer has. (Verified fields are locked, so they
   * cannot drift out of step this way.)
   */
  const provenance = (name: string): ExtractedField | null => {
    const field = extracted[name];
    if (!field) return null;
    const current = (f[name] ?? '').trim();
    if (current !== '' && current !== field.value.trim()) return null;
    return field;
  };

  /** What a given step would send right now, assembled from the form. */
  const payloadFor = (stepNumber: number): SaveStepInput => {
    if (stepNumber === 1) {
      return {
        legalEntityType: f.legalEntityType ?? '',
        legalEntityName: f.legalEntityName ?? '',
        tradeName: f.tradeName?.trim() || null,
        businessPan: f.businessPan ?? '',
        addressLine1: f.addressLine1 ?? '',
        city: f.city ?? '',
        stateCode: f.stateCode ?? '',
        pincode: f.pincode ?? '',
        primaryContactName: f.primaryContactName ?? '',
        primaryContactEmail: f.primaryContactEmail ?? '',
        primaryContactPhone: f.primaryContactPhone ?? '',
      } as SaveStepInput;
    }
    if (stepNumber === 2) {
      return {
        gstin: f.gstin ?? '',
        isMsme,
        udyamNumber: isMsme ? (f.udyamNumber ?? null) : null,
      } as SaveStepInput;
    }
    if (stepNumber === 3) {
      return {
        // Only sent for an IFSC the directory could not resolve; otherwise the
        // API overwrites it with the directory's name anyway.
        bankName: bankFromIfsc?.bank ?? f.bankName ?? '',
        accountNumber: f.accountNumber ?? '',
        ifsc: (f.ifsc ?? '').trim().toUpperCase(),
        holderName: f.holderName ?? '',
      } as SaveStepInput;
    }
    return { documentsConfirmed: true } as SaveStepInput;
  };

  /**
   * Send one step and record that it is stored.
   *
   * Resolves to whether it stuck, so Submit can flush several in order and stop
   * at the first that does not. A rejection puts the vendor on the step that was
   * rejected with its fields marked — being told "pincode is invalid" while
   * looking at the documents step explains nothing.
   */
  const persist = async (
    stepNumber: number,
    opts: { advance?: boolean; quiet?: boolean } = {},
  ): Promise<boolean> => {
    if (stepNumber === 1 && missingStatutoryDocs.length > 0) {
      // The API refuses this too; catching it here keeps the vendor on the
      // panel that has the file pickers rather than bouncing them off a 422.
      setStep(1);
      toast(
        `Upload your ${missingStatutoryDocs
          .map(vendorDocumentLabel)
          .join(' and ')} first — we fill this step in from them.`,
        'error',
      );
      return false;
    }
    const payload = payloadFor(stepNumber);
    // Validate against this step's schema before sending. The API enforces the
    // same rules, but it answers with a generic 422 whose per-field detail used
    // to be dropped — checking here names the offending field immediately.
    const schema = ONBOARDING_STEP_SCHEMAS[stepNumber];
    const parsed = schema?.safeParse(payload);
    if (parsed && !parsed.success) {
      setStep(stepNumber);
      setFieldErrors(zodFieldErrors(parsed.error));
      toast(zodSummary(parsed.error, 'Check the highlighted fields'), 'error');
      return false;
    }
    setFieldErrors({});

    try {
      await saveStep.mutateAsync({ stepNumber, data: payload });
    } catch (e) {
      // Server-only rejections (PAN/GSTIN verification, penny-drop mismatch)
      // still land on the right input.
      setStep(stepNumber);
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      toast(e instanceof Error ? e.message : 'Could not save this step', 'error');
      return false;
    }
    // The yardstick moves only on a save the server accepted, so a step stays
    // marked unsaved for exactly as long as it is.
    setSavedFields((prev) => {
      const next = { ...prev };
      for (const k of STEP_FIELDS[stepNumber] ?? []) next[k] = f[k] ?? '';
      return next;
    });
    if (stepNumber === 2) setSavedIsMsme(isMsme);
    if (!opts.quiet) toast(`Step ${stepNumber} saved`, 'success');
    if (opts.advance) setStep(Math.min(ONBOARDING_STEP_COUNT, stepNumber + 1));
    return true;
  };

  const saveCurrent = (): void => {
    void persist(step, { advance: true });
  };

  /**
   * Apply what a statutory document yielded to the form.
   *
   * A verified value replaces whatever is in the box — it is the value of
   * record, and the input is locked to it. An unverified read only fills a gap,
   * so a vendor who has already typed something never has it overwritten by a
   * guess made from a blurry scan.
   */
  const applyExtraction = (result: DocumentExtractionResult): void => {
    // The merge rule lives in wizard-hydrate so it can be tested directly —
    // "does a document overwrite what the vendor typed?" is the question this
    // whole flow turns on, and it has two answers depending on when they typed.
    setF((prev) => applyExtractedFields(prev, extracted, result.fields));
    setExtracted((prev) => ({ ...prev, ...result.fields }));
  };

  const uploadStatutoryDoc = (docType: VendorDocumentType, file: File): void => {
    setUploadingDoc(docType);
    uploadDoc.mutate(
      { docType, file },
      {
        onSuccess: (res) => {
          setLocalDocs((prev) => new Map(prev).set(docType, res));
          const result = res.extraction ?? null;
          setExtractionNotes((prev) => {
            const next = new Map(prev);
            if (result) next.set(docType, result);
            else next.delete(docType);
            return next;
          });
          if (!result) {
            toast(`${vendorDocumentLabel(docType)} uploaded`, 'success');
            return;
          }
          if (result.errors.length > 0) {
            toast(result.errors[0]!, 'error');
            return;
          }
          applyExtraction(result);
          const filled = Object.keys(result.fields).length;
          // The fields these documents fill live on step 1, so where the vendor
          // is told to look depends on where they uploaded from.
          const where = step === 1 ? 'below' : 'on step 1';
          toast(
            filled > 0
              ? `${vendorDocumentLabel(docType)} read — ${filled} field${
                  filled === 1 ? '' : 's'
                } filled in ${where}`
              : `${vendorDocumentLabel(docType)} uploaded — please fill the fields in yourself`,
            filled > 0 ? 'success' : 'info',
          );
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
    const label = vendorDocumentLabel(d);
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
          <span className="font-medium capitalize hover:underline">
            {done ? '✓ ' : ''}
            {label}
          </span>
        </label>
        {busy && (
          <span className="text-muted">
            {EXTRACTED_DOCUMENTS.includes(d) ? 'reading…' : 'uploading…'}
          </span>
        )}
        {done && (
          <>
            <span className="max-w-[180px] truncate text-[12px] text-muted">
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

  // Documents beyond the mandatory set. The vendor's category is what makes some
  // of them likely, so those are listed first — but none of them block submit.
  const categoryCfg = categoryOptions?.find((c) => c.key === data?.categoryKey);
  const mandatory = new Set<string>([
    ...ONBOARDING_STEP1_DOCUMENTS,
    ...ONBOARDING_STEP4_DOCUMENTS,
  ]);
  // Documents that already have a row of their own on this step.
  const shownAbove = new Set<string>([...mandatory, ...ONBOARDING_OPTIONAL_DOCUMENTS]);
  const suggestedDocs = [
    ...(categoryCfg?.requiredDocuments ?? []),
    ...(categoryCfg?.optionalDocuments ?? []),
  ].filter((d) => !shownAbove.has(d));
  const otherDocs = VENDOR_DOCUMENT_TYPE.filter(
    (d) => !shownAbove.has(d) && !suggestedDocs.includes(d),
  );
  /** Step-1 documents still outstanding — they gate step 4 and submission too. */
  const missingStatutoryDocs = ONBOARDING_STEP1_DOCUMENTS.filter(
    (d) => !uploadedDocs.has(d),
  );

  const doSubmit = async (): Promise<void> => {
    // Anything typed and not saved goes with the submission rather than being
    // dropped by it, and so does a step never saved at all — the API rejects a
    // submission with an unsaved step, and "Step 3 is not complete" names a step
    // rather than the field that is wrong. In step order: step 2's GSTIN is
    // checked against step 1's PAN, so saving them out of order would reject a
    // consistent pair.
    const toFlush = [1, 2, 3, 4].filter(
      (n) => dirtySteps.includes(n) || !data.wizardState?.steps?.[`step${n}`]?.done,
    );
    for (const n of toFlush) {
      if (!(await persist(n, { quiet: true }))) return;
    }
    submit.mutate(undefined, {
      onSuccess: () => toast('Onboarding submitted for review', 'success'),
      onError: (e) => toast(e.message, 'error'),
    });
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-4">
        <PageHeader
          title="Vendor onboarding"
          description={
            <>
              {editable
                ? 'Four steps. Upload your GST certificate and PAN card and we fill in what we can, then submit for review.'
                : 'Your submitted details, read-only.'}
            </>
          }
        />
        {editable && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-canvas">
              <div className="bg-brand h-full" style={{ width: `${completionPct}%` }} />
            </div>
            <span className="text-[12px] tabular-nums text-muted">
              {completionPct}% complete
            </span>
          </div>
        )}
      </div>

      {status && (
        <div
          className={`mb-4 rounded-lg border p-4 ${
            status.tone === 'success'
              ? 'border-accent-2/30 bg-accent-wash'
              : 'border-line bg-panel'
          }`}
        >
          <div className="flex items-center gap-2">
            <Pill variant={status.tone === 'success' ? 'success' : 'info'}>
              {status.pill}
            </Pill>
            <span className="text-[14px] font-semibold text-ink">{status.title}</span>
          </div>
          <p className="mt-1.5 text-[13px] text-muted">{status.body}</p>
          {/* Only while the note is still something to act on. Once the vendor
              has sent it back, repeating "reviewer note" under "under review"
              reads as a fresh request rather than the one they just answered. */}
          {data.reviewNotes && data.reviewDecision === 'RETURNED_FOR_INFO' && (
            <p className="mt-1.5 text-[13px] text-muted">
              Reviewer note: {data.reviewNotes}
            </p>
          )}
        </div>
      )}

      {/* Step tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {ONBOARDING_STEP_NAMES.map((name, i) => {
          const n = i + 1;
          const done = data.wizardState?.steps?.[`step${n}`]?.done;
          return (
            <button
              key={n}
              onClick={() => {
                setStep(n);
                setFieldErrors({});
              }}
              className={`rounded-md px-2.5 py-1 text-[12px] ${
                step === n ? 'bg-ink text-white' : done ? 'text-accent-2' : 'text-muted'
              }`}
            >
              {n}. {name}
              {/* An edit that has not been sent yet. Without it the only
                  difference between typed and saved was invisible. */}
              {dirtySteps.includes(n) && <span className="text-warn"> •</span>}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Step {step}: {ONBOARDING_STEP_NAMES[step - 1]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Read-only is the server's decision (`editable`), and hiding Save
              was not enough to express it: every input stayed live, so a vendor
              waiting on a review could type over their submitted answers and
              lose them on the next refresh. `contents` keeps the layout while
              the fieldset disables everything inside it. Step navigation sits
              outside, so a submitted application is still readable end to end. */}
          <fieldset disabled={!editable} className="contents">
            {step === 1 && (
              <>
                <div className="rounded-md border border-line bg-canvas/60 p-3">
                  <p className="text-[13px] font-medium text-ink">
                    Start with your documents
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Upload your GST registration certificate and PAN card (PDF or image, max
                    10 MB). We read them and fill in the fields below — your GSTIN is
                    checked against GSTN, and your PAN and state are taken from it rather
                    than typed.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ONBOARDING_STEP1_DOCUMENTS.map((d) => renderDocButton(d))}
                  </div>
                  <ExtractionNotes
                    results={extractionNotes}
                    forDocs={ONBOARDING_STEP1_DOCUMENTS}
                  />

                  {missingStatutoryDocs.length > 0 && (
                    <p className="mt-2 text-[12px] text-warn">
                      The fields below stay empty until we have your{' '}
                      {missingStatutoryDocs.map(vendorDocumentLabel).join(' and ')} — they
                      are read off them, and they are required to submit either way.
                    </p>
                  )}
                </div>

                <Field
                  label="Legal entity name"
                  value={f.legalEntityName ?? ''}
                  onChange={set('legalEntityName')}
                  error={fieldErrors.legalEntityName}
                  hint="As registered — for a proprietorship this is the proprietor's own name, matching the PAN"
                  provenance={provenance('legalEntityName')}
                />
                <Field
                  label="Trade name"
                  value={f.tradeName ?? ''}
                  onChange={set('tradeName')}
                  error={fieldErrors.tradeName}
                  hint="What the business trades as. This is the name your buyer sees on POs and invoices."
                  provenance={provenance('tradeName')}
                />
                <EntityTypeField
                  value={f.legalEntityType ?? ''}
                  onChange={set('legalEntityType')}
                  error={fieldErrors.legalEntityType}
                  provenance={provenance('legalEntityType')}
                />
                <Field
                  label="Business PAN"
                  value={f.businessPan ?? ''}
                  onChange={set('businessPan')}
                  placeholder="AFMFS3755D"
                  error={fieldErrors.businessPan}
                  hint="10 characters. Not your GSTIN — the PAN is characters 3–12 of it."
                  provenance={provenance('businessPan')}
                />
                <Field
                  label="Address"
                  value={f.addressLine1 ?? ''}
                  onChange={set('addressLine1')}
                  error={fieldErrors.addressLine1}
                  provenance={provenance('addressLine1')}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Field
                    label="City"
                    value={f.city ?? ''}
                    onChange={set('city')}
                    error={fieldErrors.city}
                    provenance={provenance('city')}
                  />
                  <StateCodeField
                    value={f.stateCode ?? ''}
                    onChange={set('stateCode')}
                    error={fieldErrors.stateCode}
                    provenance={provenance('stateCode')}
                  />
                  <Field
                    label="Pincode"
                    value={f.pincode ?? ''}
                    onChange={set('pincode')}
                    placeholder="110055"
                    error={fieldErrors.pincode}
                    provenance={provenance('pincode')}
                  />
                </div>
                <Field
                  label="Contact name"
                  value={f.primaryContactName ?? ''}
                  onChange={set('primaryContactName')}
                  error={fieldErrors.primaryContactName}
                />
                <Field
                  label="Contact email"
                  type="email"
                  value={f.primaryContactEmail ?? ''}
                  onChange={set('primaryContactEmail')}
                  placeholder="name@company.com"
                  error={fieldErrors.primaryContactEmail}
                />
                <Field
                  label="Contact phone"
                  value={f.primaryContactPhone ?? ''}
                  onChange={set('primaryContactPhone')}
                  error={fieldErrors.primaryContactPhone}
                />
              </>
            )}

            {step === 2 && (
              <>
                <Field
                  label="GSTIN"
                  value={f.gstin ?? ''}
                  onChange={set('gstin')}
                  placeholder="07AFMFS3755D1ZS"
                  error={fieldErrors.gstin}
                  hint="15 characters: state code + PAN + 3 more"
                  provenance={provenance('gstin')}
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
                    error={fieldErrors.udyamNumber}
                  />
                )}
                <p className="text-[12px] text-muted">
                  GSTIN & PAN are re-checked against the statutory registries on save, and
                  the two must describe the same entity — characters 3–12 of a GSTIN are the
                  PAN.
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-md border border-line bg-canvas/60 p-3">
                  <p className="text-[13px] font-medium text-ink">
                    Upload a cancelled cheque
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    We read the IFSC and account number off it. The IFSC tells us which bank
                    and branch the account is at, so you never type a bank name.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {renderDocButton('CANCELLED_CHEQUE')}
                  </div>
                  <ExtractionNotes
                    results={extractionNotes}
                    forDocs={['CANCELLED_CHEQUE']}
                  />
                </div>

                <Field
                  label="IFSC"
                  value={f.ifsc ?? ''}
                  onChange={set('ifsc')}
                  placeholder="HDFC0001234"
                  error={fieldErrors.ifsc}
                  hint="11 characters, from your cheque: 4 letters, a 0, then 6 more"
                  provenance={provenance('ifsc')}
                />
                {/* Read-only and resolved, or asked for only when the directory has
                    never heard of the code the vendor typed. */}
                {bankFromIfsc ? (
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <label className="block text-[12px] font-medium text-muted">
                        Bank
                      </label>
                      <Pill variant="success" dot>
                        Resolved from your IFSC
                      </Pill>
                    </div>
                    <Input
                      value={
                        bankFromIfsc.branch
                          ? `${bankFromIfsc.bank} — ${bankFromIfsc.branch}`
                          : bankFromIfsc.bank
                      }
                      readOnly
                      className="cursor-not-allowed bg-canvas text-muted"
                    />
                  </div>
                ) : (
                  <Field
                    label="Bank name"
                    value={f.bankName ?? ''}
                    onChange={set('bankName')}
                    error={fieldErrors.bankName}
                    hint={
                      (f.ifsc ?? '').length >= 11
                        ? 'We could not find that IFSC in the bank directory — check it, or enter your bank name.'
                        : 'Filled in for you once you enter a valid IFSC.'
                    }
                  />
                )}
                <Field
                  label="Account number"
                  value={f.accountNumber ?? ''}
                  onChange={set('accountNumber')}
                  error={fieldErrors.accountNumber}
                  provenance={provenance('accountNumber')}
                />
                <Field
                  label="Account holder name"
                  value={f.holderName ?? ''}
                  onChange={set('holderName')}
                  error={fieldErrors.holderName}
                  hint="Exactly as the bank has it — a penny drop checks this name against the account"
                />
                <p className="text-[12px] text-muted">
                  On save we credit a rupee to the account and compare the name the bank
                  returns with the one above. A mismatch does not stop you here, but your
                  buyer has to clear it before your account goes live.
                </p>
              </>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[13px] text-muted">
                    Two documents are required here (PDF or image, max 10 MB). The cancelled
                    cheque is the one you were asked for on the banking step.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_STEP4_DOCUMENTS.map((d) => renderDocButton(d))}
                  </div>
                </div>

                {/* Commercial material, not compliance: offered plainly rather than
                    hidden behind the "other documents" toggle, because a vendor who
                    has a catalogue should be invited to attach it — and one who has
                    none is never held up by it. */}
                <div>
                  <p className="mb-2 text-[12px] text-muted">
                    Optional — attach your product or price catalogue if you have one. Your
                    buyer can browse it when sourcing.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_OPTIONAL_DOCUMENTS.map((d) => renderDocButton(d))}
                  </div>
                </div>

                {/* The statutory pair is asked for on step 1, where it drives the
                    auto-fill — but it is just as mandatory as the two above, and a
                    vendor who skipped it there would otherwise be stopped here by a
                    message about documents with no picker in front of them. */}
                <div
                  className={`rounded-md border p-3 ${
                    missingStatutoryDocs.length > 0
                      ? 'border-warn/40 bg-warn-wash'
                      : 'border-line bg-canvas/60'
                  }`}
                >
                  <p className="text-[12px] text-muted">
                    {missingStatutoryDocs.length > 0
                      ? 'Still required — asked for in step 1, where they fill the form in for you:'
                      : 'Collected in step 1:'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ONBOARDING_STEP1_DOCUMENTS.map((d) => renderDocButton(d))}
                  </div>
                  <ExtractionNotes
                    results={extractionNotes}
                    forDocs={ONBOARDING_STEP1_DOCUMENTS}
                  />
                </div>

                {/* Everything else lives behind one toggle. The category's usual
                    extras are listed first inside it, because they are the ones a
                    buyer is most likely to come back and ask for — but none of them
                    block submission, so none of them belong on the surface. */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOtherDocs((v) => !v)}
                    className="text-brand text-[12px] font-medium hover:underline"
                  >
                    {showOtherDocs ? '− Hide other documents' : '+ Add other documents'}
                  </button>
                  {showOtherDocs && (
                    <div className="mt-2 space-y-3">
                      {suggestedDocs.length > 0 && (
                        <div>
                          <p className="mb-2 text-[12px] text-muted">
                            {categoryCfg
                              ? `Commonly asked for in ${categoryCfg.displayName}`
                              : 'Commonly asked for'}
                            . Your buyer may request these during review.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {suggestedDocs.map((d) => renderDocButton(d))}
                          </div>
                        </div>
                      )}
                      {otherDocs.length > 0 && (
                        <div>
                          {suggestedDocs.length > 0 && (
                            <p className="mb-2 text-[12px] text-muted">Anything else:</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {otherDocs.map((d) => renderDocButton(d))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="border-t border-line pt-4 text-[12px] text-muted">
                  By submitting you self-declare no sanctions exposure. Sanctions screening
                  runs automatically on submission.
                </p>
              </div>
            )}
          </fieldset>

          <div className="mt-4 flex justify-between border-t border-line pt-4">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            {editable && (
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={saveCurrent}
                  disabled={saveStep.isPending}
                >
                  Save step
                </Button>
                {step === ONBOARDING_STEP_COUNT && (
                  <Button
                    variant="accent"
                    onClick={() => void doSubmit()}
                    disabled={submit.isPending || saveStep.isPending}
                  >
                    Submit for review
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {editable && dirtySteps.length > 0 ? (
        <p className="mt-3 text-[13px] text-warn">
          <Pill variant="warn">Unsaved</Pill> Your changes on{' '}
          {dirtySteps.map((n) => `step ${n}`).join(' and ')} are not saved yet — use Save
          step, or submit for review and we will save them first.
        </p>
      ) : (
        editable &&
        completionPct === 100 && (
          <p className="mt-3 text-[13px] text-accent-2">
            <Pill variant="success">Ready</Pill> All steps complete — submit for review.
          </p>
        )
      )}
    </div>
  );
}
