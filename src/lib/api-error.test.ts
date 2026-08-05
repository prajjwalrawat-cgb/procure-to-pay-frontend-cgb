import { describe, expect, it } from 'vitest';

import { ApiError, toApiError, zodFieldErrors, zodSummary } from './api-error';
import { InviteVendorInputSchema, OnboardingStep1Schema } from './shared';

/**
 * The other half of the validation contract (see the API's
 * validation-problem.spec.ts): given the problem+json the server actually sends,
 * the client must produce a message naming the field in the words the form uses,
 * plus per-field errors to mark the inputs.
 */

/** The exact body the API returns for the missing-"@" invite. */
const emailProblem = {
  type: 'https://procureflow.io/errors/validation',
  title: 'Request validation failed',
  status: 422,
  detail: 'Request validation failed',
  instance: '/vendors/invite',
  context: {
    issues: [
      { path: 'email', message: 'Enter a valid email address, e.g. name@company.com' },
    ],
  },
};

describe('ApiError', () => {
  it('names the field using the form label, not the JSON key', () => {
    const err = new ApiError(422, emailProblem, 'Request failed');
    expect(err.message).toBe(
      'Contact email: Enter a valid email address, e.g. name@company.com',
    );
    // The regression this whole change exists to prevent.
    expect(err.message).not.toBe('Request validation failed');
  });

  it('exposes field errors keyed by path, ready to hang off an input', () => {
    const err = new ApiError(422, emailProblem, 'Request failed');
    expect(err.fieldErrors).toEqual({
      email: 'Enter a valid email address, e.g. name@company.com',
    });
  });

  it('summarises two issues but counts the rest, so a toast stays readable', () => {
    const err = new ApiError(
      422,
      {
        detail: 'Request validation failed',
        context: {
          issues: [
            { path: 'businessPan', message: 'PAN must be 10 characters' },
            { path: 'stateCode', message: 'Use the 2-digit GST state code' },
            { path: 'pincode', message: 'Pincode must be at least 6 digits' },
            { path: 'city', message: 'Enter your city' },
          ],
        },
      },
      'Request failed',
    );
    expect(err.message).toBe(
      'Business PAN: PAN must be 10 characters · State code: Use the 2-digit GST state code (+2 more)',
    );
    expect(Object.keys(err.fieldErrors)).toHaveLength(4);
  });

  it('falls back to detail when the error carries no field issues', () => {
    const err = new ApiError(
      409,
      { detail: 'A vendor with this email already exists', status: 409 },
      'Request failed',
    );
    expect(err.message).toBe('A vendor with this email already exists');
    expect(err.fieldErrors).toEqual({});
  });

  it('humanises paths with no explicit label instead of showing raw keys', () => {
    const err = new ApiError(
      422,
      { context: { issues: [{ path: 'someNewField', message: 'is required' }] } },
      'Request failed',
    );
    expect(err.message).toBe('Some new field: is required');
  });

  it('survives a non-JSON error body rather than masking it', async () => {
    const res = new Response('<html>502 Bad Gateway</html>', { status: 502 });
    const err = await toApiError(res, 'Request failed');
    expect(err.status).toBe(502);
    expect(err.message).toBe('Request failed: 502');
  });

  it('reads a real problem+json Response end to end', async () => {
    const res = new Response(JSON.stringify(emailProblem), {
      status: 422,
      headers: { 'Content-Type': 'application/problem+json' },
    });
    const err = await toApiError(res, 'Request failed');
    expect(err.fieldErrors.email).toContain('name@company.com');
  });
});

describe('client-side pre-validation', () => {
  it('produces the same message the server would, without the round trip', () => {
    const parsed = InviteVendorInputSchema.safeParse({
      legalEntityName: 'Sau Rang India',
      name: 'Kapil',
      email: 'saurangindia.gmail.com',
      categoryKey: 'packaging',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(zodSummary(parsed.error, 'fallback')).toBe(
      new ApiError(422, emailProblem, 'Request failed').message,
    );
    expect(zodFieldErrors(parsed.error)).toEqual({
      email: 'Enter a valid email address, e.g. name@company.com',
    });
  });

  it('flags both the GSTIN-in-PAN and the state-name mistakes at once', () => {
    const parsed = OnboardingStep1Schema.safeParse({
      legalEntityType: 'PVT_LTD',
      legalEntityName: 'Sau Rang India',
      businessPan: '07AFMFS3755D1ZS',
      addressLine1: 'B-66, Flatted Factory Complex, Jhandewalan',
      city: 'New Delhi',
      stateCode: 'DEL',
      pincode: '110055',
      primaryContactName: 'Kapil',
      primaryContactEmail: 'saurangindia@gmail.com',
      primaryContactPhone: '9212003772',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = zodFieldErrors(parsed.error);
    expect(Object.keys(errors).sort()).toEqual(['businessPan', 'stateCode']);
    expect(errors.businessPan).toContain('characters 3–12');
    expect(errors.stateCode).toContain('07 for Delhi');
  });

  it('rejects a well-formed but non-existent state code', () => {
    const base = {
      legalEntityType: 'PVT_LTD',
      legalEntityName: 'Sau Rang India',
      businessPan: 'AFMFS3755D',
      addressLine1: 'B-66, Flatted Factory Complex, Jhandewalan',
      city: 'New Delhi',
      pincode: '110055',
      primaryContactName: 'Kapil',
      primaryContactEmail: 'saurangindia@gmail.com',
      primaryContactPhone: '9212003772',
    };
    // "AB" is 2 characters — the old length(2) rule let it through, and the wrong
    // GST heads only showed up much later on an invoice.
    for (const bad of ['AB', '00', '99']) {
      const parsed = OnboardingStep1Schema.safeParse({ ...base, stateCode: bad });
      expect(parsed.success, `expected ${bad} to be rejected`).toBe(false);
    }
    // A retired code still parses so legacy records can be re-saved.
    expect(OnboardingStep1Schema.safeParse({ ...base, stateCode: '28' }).success).toBe(
      true,
    );
  });

  it('accepts the corrected values', () => {
    const parsed = OnboardingStep1Schema.safeParse({
      legalEntityType: 'PVT_LTD',
      legalEntityName: 'Sau Rang India',
      businessPan: 'AFMFS3755D',
      addressLine1: 'B-66, Flatted Factory Complex, Jhandewalan',
      city: 'New Delhi',
      stateCode: '07',
      pincode: '110055',
      primaryContactName: 'Kapil',
      primaryContactEmail: 'saurangindia@gmail.com',
      primaryContactPhone: '9212003772',
    });
    expect(parsed.success).toBe(true);
  });
});
