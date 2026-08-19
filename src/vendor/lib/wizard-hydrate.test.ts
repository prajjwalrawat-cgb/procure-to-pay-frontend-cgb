import { describe, expect, it } from 'vitest';

import {
  applyExtractedFields,
  fieldProvenance,
  hydrateWizardForm,
  type WizardState,
} from './wizard-hydrate';

/**
 * The wizard used to start from an empty form and never read the saved steps
 * back, so a vendor returning to it saw "83% complete" above blank inputs and
 * retyped everything. These cover the rebuild.
 */
describe('hydrateWizardForm', () => {
  const saved: WizardState = {
    currentStep: 4,
    completionPct: 75,
    steps: {
      step1: {
        done: true,
        data: {
          legalEntityType: 'PVT_LTD',
          legalEntityName: 'Arjun Enterprises',
          businessPan: 'AFMFS3755D',
          addressLine1: '12 Industrial Area',
          city: 'New Delhi',
          stateCode: '07',
          pincode: '110055',
          primaryContactName: 'Anuj',
          primaryContactEmail: 'anuj@example.com',
          primaryContactPhone: '9810000000',
        },
      },
      step2: {
        done: true,
        data: {
          gstin: '07AFMFS3755D1ZK',
          isMsme: true,
          udyamNumber: 'UDYAM-DL-01-0000001',
        },
      },
      step3: {
        done: true,
        data: {
          bankName: 'HDFC',
          accountNumber: '50100123456789',
          ifsc: 'HDFC0000123',
          holderName: 'Arjun Enterprises',
        },
      },
      step4: { done: false, data: { documentsConfirmed: true } },
    },
  };

  it('restores every text field the vendor already entered', () => {
    const { fields } = hydrateWizardForm(saved);
    expect(fields.legalEntityName).toBe('Arjun Enterprises');
    expect(fields.businessPan).toBe('AFMFS3755D');
    expect(fields.pincode).toBe('110055');
    expect(fields.stateCode).toBe('07');
    expect(fields.primaryContactEmail).toBe('anuj@example.com');
    expect(fields.gstin).toBe('07AFMFS3755D1ZK');
    expect(fields.accountNumber).toBe('50100123456789');
    expect(fields.legalEntityType).toBe('PVT_LTD');
  });

  it('surfaces the MSME flag for its own control, not as a text field', () => {
    const { fields, isMsme } = hydrateWizardForm(saved);
    expect(isMsme).toBe(true);
    expect(fields.isMsme).toBeUndefined();
  });

  it('drops payload constants that have no input of their own', () => {
    expect(hydrateWizardForm(saved).fields.documentsConfirmed).toBeUndefined();
  });

  it('skips nulls so a cleared optional field stays empty rather than "null"', () => {
    const { fields } = hydrateWizardForm({
      currentStep: 2,
      completionPct: 25,
      steps: {
        step2: { done: true, data: { gstin: '07AAAAA0000A1Z5', udyamNumber: null } },
      },
    });
    expect(fields.gstin).toBe('07AAAAA0000A1Z5');
    expect(fields.udyamNumber).toBeUndefined();
  });

  it('handles a wizard that has not been started', () => {
    expect(hydrateWizardForm(null)).toEqual({ fields: {}, isMsme: false });
    expect(hydrateWizardForm(undefined).fields).toEqual({});
    expect(
      hydrateWizardForm({ currentStep: 1, completionPct: 0, steps: {} }).fields,
    ).toEqual({});
  });
});

/**
 * The auto-fill layer: a vendor who uploaded their GST certificate should find
 * the form already filled, and a value they have since corrected must survive.
 */
describe('hydrateWizardForm — document auto-fill', () => {
  const extracted = {
    businessPan: {
      value: 'AAPFU0939F',
      source: 'DERIVED' as const,
      verified: true,
      confidence: 1,
    },
    legalEntityName: {
      value: 'Umang Fabricators',
      source: 'OCR' as const,
      verified: false,
      confidence: 0.75,
    },
  };

  it('fills fields the vendor has not saved yet', () => {
    const { fields } = hydrateWizardForm({
      currentStep: 1,
      completionPct: 0,
      steps: {},
      extracted,
    });
    expect(fields.businessPan).toBe('AAPFU0939F');
    expect(fields.legalEntityName).toBe('Umang Fabricators');
  });

  it('never overwrites a value the vendor already saved', () => {
    const { fields } = hydrateWizardForm({
      currentStep: 2,
      completionPct: 25,
      steps: {
        step1: { done: true, data: { legalEntityName: 'Umang Fabricators LLP' } },
      },
      extracted,
    });
    expect(fields.legalEntityName).toBe('Umang Fabricators LLP');
  });

  it('exposes provenance so a field can be badged and locked', () => {
    const state: WizardState = {
      currentStep: 1,
      completionPct: 0,
      steps: {},
      extracted,
    };
    expect(fieldProvenance(state, 'businessPan')?.verified).toBe(true);
    expect(fieldProvenance(state, 'legalEntityName')?.verified).toBe(false);
    expect(fieldProvenance(state, 'city')).toBeNull();
  });
});

/**
 * The question the whole document-first flow turns on: when a certificate says
 * one thing and the box says another, which wins? It depends entirely on
 * whether the vendor typed before the document arrived or after it.
 */
describe('applyExtractedFields', () => {
  const fromDoc = {
    legalEntityName: {
      value: 'ARJUN YADAV',
      source: 'OCR' as const,
      verified: false,
      confidence: 1,
    },
    businessPan: {
      value: 'BIMPY7581H',
      source: 'DERIVED' as const,
      verified: true,
      confidence: 1,
    },
  };

  it('fills empty fields', () => {
    expect(applyExtractedFields({}, {}, fromDoc)).toEqual({
      legalEntityName: 'ARJUN YADAV',
      businessPan: 'BIMPY7581H',
    });
  });

  it('overwrites a guess typed before any document was uploaded', () => {
    // The vendor filled the form, was told to upload, and did. Their guess was
    // never a correction of anything — the certificate supersedes it.
    const typedFirst = { legalEntityName: 'Arjun', businessPan: 'ZZZZZ1111Z' };
    expect(applyExtractedFields(typedFirst, {}, fromDoc)).toEqual({
      legalEntityName: 'ARJUN YADAV',
      businessPan: 'BIMPY7581H',
    });
  });

  it('keeps a correction the vendor made after the document supplied the field', () => {
    // "ARJUN YADAV 2." was a misread; the vendor fixed it. Re-uploading the same
    // certificate must not undo that.
    const corrected = { legalEntityName: 'Arjun Yadav' };
    const result = applyExtractedFields(corrected, fromDoc, fromDoc);
    expect(result.legalEntityName).toBe('Arjun Yadav');
  });

  it('still overwrites a verified field, which cannot have been edited anyway', () => {
    const tampered = { businessPan: 'ZZZZZ1111Z' };
    const result = applyExtractedFields(tampered, fromDoc, fromDoc);
    expect(result.businessPan).toBe('BIMPY7581H');
  });

  it('leaves fields the document said nothing about alone', () => {
    const result = applyExtractedFields({ primaryContactName: 'R. Shah' }, {}, fromDoc);
    expect(result.primaryContactName).toBe('R. Shah');
  });
});
