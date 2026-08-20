'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Pill,
  SandboxBanner,
  VerificationResult,
} from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { IntegrationProvider, OnboardingDetailResponse } from '@/lib/shared';

import { useProviderLiveness } from '@/lib/integration-status';
import {
  useOnboardingDecision,
  useOnboardingDetail,
  useOverrideBank,
  useRenameVendor,
  useReturnForInfo,
  useReviewScreening,
  useVerifyDocument,
} from '@/lib/api/vendors';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/shared';
import { useToastStore } from '@/store/toast-store';

const LIGHT_VARIANT: Record<'green' | 'amber' | 'red', 'success' | 'warn' | 'danger'> = {
  green: 'success',
  amber: 'warn',
  red: 'danger',
};

const DOC_VARIANT: Record<string, 'success' | 'warn' | 'danger' | 'gray'> = {
  AUTO_VERIFIED: 'success',
  MANUALLY_VERIFIED: 'success',
  PENDING: 'warn',
  FAILED: 'danger',
  EXPIRED: 'danger',
};

/**
 * What stands between this onboarding and a decision.
 *
 * The panel used to say only "not currently awaiting your review", which is
 * true of two very different situations: a vendor who has not submitted, and a
 * submission sitting with a different approver. Naming the outstanding work
 * turns a dead end into something the officer can act on — usually by chasing
 * the vendor, which is what Return for info is for.
 */
function NotYourTurn({ data }: { data: OnboardingDetailResponse }): React.JSX.Element {
  if (data.submittedAt) {
    return (
      <p className="text-[13px] text-muted">
        Submitted on {new Date(data.submittedAt).toLocaleDateString()} — waiting on
        another approver in the chain, so there is nothing for you to decide here.
      </p>
    );
  }
  const outstanding = data.steps.filter((s) => !s.done);
  return (
    <div className="space-y-2 text-[13px]">
      <p className="text-muted">
        The vendor has not submitted yet ({data.completionPct}% complete), so there is
        nothing to approve. They can still change everything below.
      </p>
      {outstanding.length > 0 && (
        <div>
          <p className="text-[12px] text-muted">Still to complete:</p>
          <ul className="mt-1 space-y-0.5">
            {outstanding.map((s) => (
              <li key={s.step} className="text-[12px] text-ink">
                {s.step}. {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Corrects a vendor's name. The legal entity name is what PAN/GST verification
 * matched against, so the API freezes it once the vendor is activated — until
 * then a buyer can fix both here.
 */
function RenameVendorDialog({
  open,
  vendorId,
  currentName,
  currentLegalName,
  onClose,
}: {
  open: boolean;
  vendorId: string;
  currentName: string;
  currentLegalName: string | null;
  onClose: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(currentName);
  const [legalEntityName, setLegalEntityName] = useState(currentLegalName ?? '');
  const rename = useRenameVendor(vendorId);
  const toast = useToastStore((s) => s.push);

  const submit = (): void => {
    rename.mutate(
      {
        name: name.trim(),
        // Only send the legal name when there is one to send, so a vendor who
        // has not reached wizard step 1 yet is not given an empty string.
        ...(legalEntityName.trim() ? { legalEntityName: legalEntityName.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast('Vendor name updated', 'success');
          onClose();
        },
        onError: (e) => toast(e.message || 'Could not update the name', 'error'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Edit vendor name</DialogTitle>
        <DialogDescription>
          The display name is the label used across lists and reports. The legal entity
          name is the registered name that PAN and GST checks match against — it can only
          be corrected before the vendor is activated. The change is recorded in the audit
          log.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted">
              Display name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted">
              Legal entity name
            </label>
            <Input
              value={legalEntityName}
              onChange={(e) => setLegalEntityName(e.target.value)}
              placeholder="Lohith Material Pvt Ltd"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={rename.isPending || name.trim().length < 2}
          >
            {rename.isPending ? 'Saving…' : 'Save name'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OnboardingReviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading } = useOnboardingDetail(id);
  const decide = useOnboardingDecision(id);
  const returnForInfo = useReturnForInfo(id);
  const verifyDoc = useVerifyDocument(id);
  const reviewScreening = useReviewScreening(id);
  const overrideBank = useOverrideBank(id, data?.vendorId ?? '');
  const toast = useToastStore((s) => s.push);
  const [comment, setComment] = useState('');
  const [bankReason, setBankReason] = useState('');
  const [renaming, setRenaming] = useState(false);
  // The dossier is readable by anyone with VENDOR_ONBOARDING_READ (finance
  // watches the pipeline), so each write control is gated on its own
  // permission. The decision panel is gated server-side by `canReview`.
  const canRename = useHasPermission(PERMISSIONS.VENDOR_UPDATE);
  const canVerifyDocs = useHasPermission(PERMISSIONS.VENDOR_DOC_VERIFY);
  const canReviewScreening = useHasPermission(PERMISSIONS.VENDOR_SCREENING_REVIEW);
  const { isSimulated } = useProviderLiveness();
  // Any provider behind a screening or document check answering from a
  // sandbox makes every derived green signal on this page unearned.
  const anyScreeningSimulated = (data?.screenings ?? []).some((sc) =>
    isSimulated(sc.provider as IntegrationProvider),
  );
  // Documents are auto-verified against the PAN and GSTN registries; if
  // either is answering from a sandbox, an AUTO VERIFIED badge is unearned.
  const statutoryVerificationSimulated =
    isSimulated('PAN') || isSimulated('GSTN');
  // The penny drop has no row of its own to chip, so its liveness is read
  // straight off the provider registry.
  const pennyDropSimulated = isSimulated('PENNY_DROP');

  if (isLoading || !data) return <p className="p-6 text-[13px] text-muted">Loading…</p>;

  const act = (decision: 'APPROVE' | 'REJECT'): void => {
    if (!data.myApprovalId) return;
    decide.mutate(
      { approvalId: data.myApprovalId, decision, comment: comment || undefined },
      {
        onSuccess: () =>
          toast(
            decision === 'APPROVE' ? 'Onboarding approved' : 'Onboarding rejected',
            'success',
          ),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const sendBack = (): void => {
    const item = comment.trim();
    if (!item) {
      toast('Add a note describing what is needed', 'error');
      return;
    }
    returnForInfo.mutate(
      { items: [item], note: item },
      {
        onSuccess: () => toast('Returned to vendor for more info', 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-4">
        <Link
          href="/vendors/onboarding"
          className="text-[12px] text-muted hover:text-ink"
        >
          ← Onboarding queue
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-[20px] font-semibold tracking-heading text-ink">
            {data.vendorName}
          </h1>
          {data.isMsme && <Pill variant="info">MSME</Pill>}
          <Pill variant="gray">{data.lifecycleStatus.replace(/_/g, ' ')}</Pill>
          {canRename && (
            <button
              onClick={() => setRenaming(true)}
              className="text-[12px] font-medium text-muted underline hover:text-ink"
            >
              Edit name
            </button>
          )}
        </div>
        <p className="text-[13px] text-muted">
          {data.legalEntityName} · {data.category ?? '—'} · {data.completionPct}% complete
          · open {data.daysOpen}d
        </p>
      </div>

      {/* The risk lights and the AUTO VERIFIED document pills are both derived
          from the same screening providers as the verdicts below, so when those
          run in a sandbox every green signal on this page is unearned. The
          individual verdicts are chipped; this states it once for the roll-ups. */}
      {(anyScreeningSimulated || pennyDropSimulated) && (
        <SandboxBanner className="mb-4">
          <span className="font-semibold">Automated checks are simulated.</span>{' '}
          {[
            anyScreeningSimulated && 'screenings and document verification',
            pennyDropSimulated && 'the bank penny-drop check',
          ]
            .filter(Boolean)
            .join(' and ')}{' '}
          on this vendor came from sandbox providers. Do not treat the green signals —
          including sanctions and the account-holder match — as assurance when approving.
        </SandboxBanner>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Risk traffic-lights */}
          <Card>
            <CardHeader>
              <CardTitle>Risk assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.riskLights.map((l) => (
                  <Pill key={l.key} variant={LIGHT_VARIANT[l.state]} dot>
                    {l.label}
                  </Pill>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Wizard steps */}
          <Card>
            <CardHeader>
              <CardTitle>Wizard progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1">
                {data.steps.map((s) => (
                  <li key={s.step} className="flex items-center gap-2 text-[13px]">
                    <span className={s.done ? 'text-accent-2' : 'text-faint'}>
                      {s.done ? '●' : '○'}
                    </span>
                    <span className={s.done ? 'text-ink' : 'text-muted'}>
                      {s.step}. {s.name}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Banking — the one field on this page that moves money. */}
          <Card>
            <CardHeader>
              <CardTitle>Bank account</CardTitle>
            </CardHeader>
            <CardContent>
              {!data.bank ? (
                <p className="text-[13px] text-muted">No bank account submitted yet.</p>
              ) : (
                <div className="space-y-2 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">
                      {data.bank.bankName} · ••••{data.bank.accountNoLast4} ·{' '}
                      {data.bank.ifsc}
                    </span>
                    <VerificationResult
                      status={
                        data.bank.isVerified
                          ? 'Penny drop matched'
                          : data.bank.manualOverrideReason
                            ? 'Accepted by a reviewer'
                            : 'Holder name not confirmed'
                      }
                      variant={
                        data.bank.isVerified
                          ? 'success'
                          : data.bank.manualOverrideReason
                            ? 'warn'
                            : 'danger'
                      }
                      /* Only a *pass* can be unearned. A mismatch or a reviewer's
                         written acceptance says something real either way, and
                         chipping those would bury the signal in noise. */
                      simulated={data.bank.isVerified && pennyDropSimulated}
                      label="penny-drop check"
                    />
                  </div>
                  <p className="text-muted">
                    Declared holder:{' '}
                    <span className="text-ink">{data.bank.holderName}</span>
                    {data.bank.pennyDropNameReturned && (
                      <>
                        {' · '}bank returned:{' '}
                        <span className="text-ink">
                          {data.bank.pennyDropNameReturned}
                        </span>
                      </>
                    )}
                    {data.bank.nameMatchScore !== null && (
                      <> · match {Math.round(data.bank.nameMatchScore * 100)}%</>
                    )}
                  </p>
                  {data.bank.manualOverrideReason && (
                    <p className="text-[12px] text-muted">
                      Accepted: {data.bank.manualOverrideReason}
                    </p>
                  )}
                  {!data.bank.isVerified && !data.bank.manualOverrideReason && (
                    <div className="space-y-2 rounded-md border border-warn/40 bg-warn-wash p-3">
                      <p className="text-[12px]">
                        The bank did not confirm this name holds this account. Check it
                        against the cancelled cheque before activation — this vendor
                        cannot be activated until you accept it or send it back.
                      </p>
                      {canVerifyDocs && (
                        <>
                          <Input
                            value={bankReason}
                            onChange={(e) => setBankReason(e.target.value)}
                            placeholder="What did you check? (recorded against your name)"
                          />
                          <Button
                            variant="default"
                            disabled={
                              overrideBank.isPending || bankReason.trim().length < 10
                            }
                            onClick={() =>
                              overrideBank.mutate(
                                { reason: bankReason.trim() },
                                {
                                  onSuccess: () => {
                                    setBankReason('');
                                    toast('Bank account accepted', 'success');
                                  },
                                  onError: (e) => toast(e.message, 'error'),
                                },
                              )
                            }
                          >
                            Accept this account
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {data.documents.length === 0 ? (
                <p className="text-[13px] text-muted">No documents uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <div>
                        <span className="font-medium text-ink">
                          {d.docType.replace(/_/g, ' ')}
                        </span>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand ml-2 font-medium hover:underline"
                          >
                            {d.filename}
                          </a>
                        ) : (
                          <span className="ml-2 text-muted">
                            {d.filename} (file unavailable)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {d.url && (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand text-[12px] font-medium hover:underline"
                          >
                            View
                          </a>
                        )}
                        {/* AUTO VERIFIED means a statutory provider (PAN /
                            GSTN) matched the document. When those run in a
                            sandbox that green is unearned, so it is chipped
                            like any other simulated verdict. MANUALLY VERIFIED
                            was a human and keeps its colour either way. */}
                        <VerificationResult
                          status={d.verificationStatus.replace(/_/g, ' ')}
                          variant={DOC_VARIANT[d.verificationStatus] ?? 'gray'}
                          dot={false}
                          simulated={
                            d.verificationStatus === 'AUTO_VERIFIED' &&
                            statutoryVerificationSimulated
                          }
                          label="document verification"
                        />
                        {d.verificationStatus === 'PENDING' && canVerifyDocs && (
                          <>
                            <Button
                              variant="default"
                              onClick={() =>
                                verifyDoc.mutate(
                                  { docId: d.id, decision: 'VERIFIED' },
                                  {
                                    onSuccess: () =>
                                      toast('Document verified', 'success'),
                                  },
                                )
                              }
                            >
                              Verify
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                verifyDoc.mutate(
                                  {
                                    docId: d.id,
                                    decision: 'REJECTED',
                                    reason: 'Illegible',
                                  },
                                  {
                                    onSuccess: () =>
                                      toast('Document rejected', 'success'),
                                  },
                                )
                              }
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Screenings */}
          <Card>
            <CardHeader>
              <CardTitle>Screenings</CardTitle>
            </CardHeader>
            <CardContent>
              {data.screenings.length === 0 ? (
                <p className="text-[13px] text-muted">No screenings run yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.screenings.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                    >
                      <span className="text-ink">
                        {s.screeningType.replace(/_/g, ' ')}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* A green CLEAR from a sandbox screener is the most
                            dangerous badge in the product — someone could
                            onboard a sanctioned counterparty on the strength
                            of it. VerificationResult drops the colour and adds
                            the sandbox chip when the provider is not live.
                            An unrecognised provider fails closed to sandbox. */}
                        <VerificationResult
                          status={s.status}
                          variant={
                            s.status === 'CLEAR'
                              ? 'success'
                              : s.status === 'FLAGGED'
                                ? 'danger'
                                : 'warn'
                          }
                          dot={false}
                          simulated={isSimulated(s.provider as IntegrationProvider)}
                          label={`${s.screeningType.replace(/_/g, ' ').toLowerCase()} screening`}
                        />
                        {s.status === 'FLAGGED' && canReviewScreening && (
                          <Button
                            variant="default"
                            onClick={() =>
                              reviewScreening.mutate(
                                {
                                  screeningId: s.id,
                                  decision: 'ACCEPT_RISK',
                                  notes: 'Reviewed',
                                },
                                { onSuccess: () => toast('Risk accepted', 'success') },
                              )
                            }
                          >
                            Accept risk
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Beneficial owners */}
          {data.beneficialOwners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Beneficial owners</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-[13px]">
                  {data.beneficialOwners.map((o) => (
                    <li key={o.id} className="flex justify-between">
                      <span className="text-ink">
                        {o.ownerName}{' '}
                        <span className="text-muted">({o.ownershipPct}%)</span>
                      </span>
                      {o.isPep && <Pill variant="warn">PEP</Pill>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Decision panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent>
              {data.canReview ? (
                <>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comment / reason (required to return or reject)…"
                    className="bg-surface mb-3 w-full rounded-md border border-line px-3 py-2 text-[13px] text-ink"
                    rows={4}
                  />
                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={decide.isPending}
                      onClick={() => act('APPROVE')}
                    >
                      Approve & activate
                    </Button>
                    <Button
                      variant="default"
                      className="w-full"
                      disabled={returnForInfo.isPending}
                      onClick={sendBack}
                    >
                      Return for info
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      disabled={decide.isPending}
                      onClick={() => act('REJECT')}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              ) : (
                <NotYourTurn data={data} />
              )}
              <div className="mt-4 text-[12px] text-muted">
                SLA target: {data.slaTargetHours}h
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {renaming && (
        // Keyed on the current values so the inputs start from what is on screen
        // after a save, rather than the values captured on first render.
        <RenameVendorDialog
          open={renaming}
          vendorId={data.vendorId}
          currentName={data.vendorName}
          currentLegalName={data.legalEntityName}
          onClose={() => setRenaming(false)}
        />
      )}
    </div>
  );
}
