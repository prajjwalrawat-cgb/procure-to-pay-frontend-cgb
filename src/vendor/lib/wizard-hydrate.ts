/**
 * Rebuilding the onboarding wizard's form state from what the server saved.
 *
 * Deliberately dependency-free — no api-client, no store — so it stays a pure
 * function that can be tested directly.
 */

export interface WizardState {
  currentStep: number;
  completionPct: number;
  steps: Record<string, { done: boolean; data: Record<string, unknown> }>;
}

/** Form state rebuilt from a saved wizard, ready to seed the wizard's inputs. */
export interface HydratedWizard {
  /** Flat text-input values, keyed exactly as the step payloads key them. */
  fields: Record<string, string>;
  isMsme: boolean;
  isRelatedParty: boolean;
}

/**
 * Values that drive dedicated controls or are sent as fixed payload constants —
 * they must not leak into the flat text-field map.
 */
const NON_FIELD_KEYS = new Set([
  'legalEntityType',
  'employeeCountBracket',
  'sanctionsSelfDeclaration',
  'certifications',
  'facilities',
  'references',
  'beneficialOwners',
]);

/**
 * Rebuild the wizard's form state from what the server already has.
 *
 * The wizard used to start from an empty object and never read the saved steps
 * back, so a vendor returning after a refresh — or after days away — saw a
 * progress bar reporting most of the form complete above inputs that were all
 * blank, and would retype everything. The data was never lost; it simply was
 * not being read.
 *
 * Values are mapped by key, so a newly added field rehydrates without touching
 * this function. Arrays are re-joined into the comma-separated form the inputs
 * use, and the two booleans are surfaced separately for their checkboxes.
 */
export function hydrateWizardForm(state: WizardState | null | undefined): HydratedWizard {
  const fields: Record<string, string> = {};
  let isMsme = false;
  let isRelatedParty = false;

  for (const step of Object.values(state?.steps ?? {})) {
    for (const [key, value] of Object.entries(step?.data ?? {})) {
      if (key === 'isMsme') {
        isMsme = value === true;
        continue;
      }
      if (key === 'isRelatedParty') {
        isRelatedParty = value === true;
        continue;
      }
      if (NON_FIELD_KEYS.has(key)) continue;
      if (value === null || value === undefined || typeof value === 'boolean') continue;

      if (Array.isArray(value)) {
        // Only tag lists round-trip as text; arrays of objects have no input.
        if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
          fields[key] = value.join(', ');
        }
        continue;
      }
      if (typeof value === 'object') continue;
      fields[key] = String(value);
    }
  }

  return { fields, isMsme, isRelatedParty };
}
