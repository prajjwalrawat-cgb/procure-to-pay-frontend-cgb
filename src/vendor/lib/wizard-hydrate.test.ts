import { describe, expect, it } from 'vitest';

import { hydrateWizardForm, type WizardState } from './wizard-hydrate';

/**
 * The wizard used to start from an empty form and never read the saved steps
 * back, so a vendor returning to it saw "83% complete" above blank inputs and
 * retyped everything. These cover the rebuild.
 */
describe('hydrateWizardForm', () => {
  const saved: WizardState = {
    currentStep: 4,
    completionPct: 83,
    steps: {
      step1: {
        done: true,
        data: {
          legalEntityType: 'PVT_LTD',
          legalEntityName: 'Arjun Enterprises',
          businessPan: 'AFMFS3755D',
          addressLine1: '12 Industrial Area',
          city: 'New Delhi',
          stateCode: 'DL',
          pincode: '110055',
          primaryContactName: 'Anuj',
          primaryContactEmail: 'anuj@example.com',
          primaryContactPhone: '9810000000',
        },
      },
      step2: { done: true, data: { gstin: '07AFMFS3755D1ZK', isMsme: true, udyamNumber: 'UDYAM-DL-01-0000001' } },
      step3: {
        done: true,
        data: { bankName: 'HDFC', accountNumber: '50100123456789', ifsc: 'HDFC0000123', holderName: 'Arjun Enterprises' },
      },
      step5: {
        done: true,
        data: {
          categoryTags: ['packaging', 'printing'],
          capabilityTags: ['offset'],
          facilities: [],
          references: [],
          employeeCountBracket: '10-50',
          annualTurnoverDeclared: '25000000',
        },
      },
      step6: {
        done: false,
        data: { beneficialOwners: [], sanctionsSelfDeclaration: true, isRelatedParty: false },
      },
    },
  };

  it('restores every text field the vendor already entered', () => {
    const { fields } = hydrateWizardForm(saved);
    expect(fields.legalEntityName).toBe('Arjun Enterprises');
    expect(fields.businessPan).toBe('AFMFS3755D');
    expect(fields.pincode).toBe('110055');
    expect(fields.stateCode).toBe('DL');
    expect(fields.primaryContactEmail).toBe('anuj@example.com');
    expect(fields.gstin).toBe('07AFMFS3755D1ZK');
    expect(fields.accountNumber).toBe('50100123456789');
    expect(fields.annualTurnoverDeclared).toBe('25000000');
  });

  it('surfaces the two booleans for their own controls, not as text fields', () => {
    const { fields, isMsme, isRelatedParty } = hydrateWizardForm(saved);
    expect(isMsme).toBe(true);
    expect(isRelatedParty).toBe(false);
    expect(fields.isMsme).toBeUndefined();
    expect(fields.isRelatedParty).toBeUndefined();
  });

  it('re-joins tag arrays into the comma-separated form the inputs use', () => {
    const { fields } = hydrateWizardForm(saved);
    expect(fields.categoryTags).toBe('packaging, printing');
    expect(fields.capabilityTags).toBe('offset');
  });

  it('drops payload constants and structural values that have no input', () => {
    const { fields } = hydrateWizardForm(saved);
    for (const key of [
      'legalEntityType',
      'employeeCountBracket',
      'sanctionsSelfDeclaration',
      'beneficialOwners',
      'facilities',
      'references',
    ]) {
      expect(fields[key]).toBeUndefined();
    }
  });

  it('skips nulls so a cleared optional field stays empty rather than "null"', () => {
    const { fields } = hydrateWizardForm({
      currentStep: 2,
      completionPct: 20,
      steps: { step2: { done: true, data: { gstin: '07AAAAA0000A1Z5', udyamNumber: null } } },
    });
    expect(fields.gstin).toBe('07AAAAA0000A1Z5');
    expect(fields.udyamNumber).toBeUndefined();
  });

  it('handles a wizard that has not been started', () => {
    expect(hydrateWizardForm(null)).toEqual({ fields: {}, isMsme: false, isRelatedParty: false });
    expect(hydrateWizardForm(undefined).fields).toEqual({});
    expect(
      hydrateWizardForm({ currentStep: 1, completionPct: 0, steps: {} }).fields,
    ).toEqual({});
  });
});
