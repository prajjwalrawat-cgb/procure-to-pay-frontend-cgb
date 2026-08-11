/**
 * Typed client-side view of the API's RFC 7807 problem+json body.
 *
 * The API already reports *which* field failed and why — ZodValidationPipe puts
 * every issue in `context.issues` as `{ path, message }`. Both fetch clients used
 * to throw `new Error(problem.detail)`, and for a 422 `detail` is the constant
 * string "Request validation failed", so every validation error surfaced as that
 * one useless toast. This class keeps the issues attached so callers can render a
 * real message and mark the offending inputs.
 */

export interface ProblemIssue {
  /** Dotted path into the request body, e.g. `email`, `beneficialOwners.0.name`. */
  path: string;
  message: string;
}

interface ProblemBody {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  /** `issues` is the validation-error shape; domain errors put their own keys
   *  here too (e.g. the duplicate-invite guard's `existingVendorId`). */
  context?: { issues?: ProblemIssue[] } & Record<string, unknown>;
}

/** Field path → the label the user actually sees on the form. */
const FIELD_LABELS: Record<string, string> = {
  // Invite / self-registration
  legalEntityName: 'Legal entity name',
  name: 'Display name',
  email: 'Contact email',
  categoryKey: 'Category',
  phone: 'Phone',
  password: 'Password',
  // Onboarding step 1 — company basics
  legalEntityType: 'Legal entity type',
  dateOfIncorporation: 'Date of incorporation',
  businessPan: 'Business PAN',
  addressLine1: 'Address',
  city: 'City',
  stateCode: 'State code',
  pincode: 'Pincode',
  primaryContactName: 'Contact name',
  primaryContactEmail: 'Contact email',
  primaryContactPhone: 'Contact phone',
  // Step 2 — statutory identity
  gstin: 'GSTIN',
  isMsme: 'MSME registration',
  udyamNumber: 'Udyam number',
  // Step 3 — banking
  bankName: 'Bank name',
  accountNumber: 'Account number',
  ifsc: 'IFSC',
  holderName: 'Account holder name',
  // Step 5 — capabilities
  categoryTags: 'Categories',
  capabilityTags: 'Capabilities',
  employeeCountBracket: 'Employee count',
  annualTurnoverDeclared: 'Annual turnover',
  // Step 6 — ownership
  beneficialOwners: 'Beneficial owners',
  ownershipType: 'Ownership type',
};

/** `primaryContactEmail` → `Primary contact email`, for paths we have no label for. */
function humanizePath(path: string): string {
  const words = path
    .replace(/\.(\d+)\./g, ' #$1 ') // beneficialOwners.0.name → beneficialOwners #0 name
    .replace(/\./g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export function labelForPath(path: string): string {
  return FIELD_LABELS[path] ?? humanizePath(path);
}

/** "Contact email: Enter a valid email address, e.g. name@company.com" */
function describeIssue(issue: ProblemIssue): string {
  return issue.path ? `${labelForPath(issue.path)}: ${issue.message}` : issue.message;
}

/**
 * One sentence a user can act on. Two issues are both worth reading; beyond that
 * a toast becomes a wall of text, so the rest are counted — the inline field
 * errors carry the detail.
 */
export function summarizeIssues(issues: ProblemIssue[], fallback: string): string {
  if (issues.length === 0) return fallback;
  if (issues.length <= 2) return issues.map(describeIssue).join(' · ');
  return `${issues.slice(0, 2).map(describeIssue).join(' · ')} (+${issues.length - 2} more)`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  /** Raw `detail` from the API — the generic title for validation failures. */
  readonly detail: string;
  readonly issues: ProblemIssue[];
  /** `{ email: 'Enter a valid email address…' }` — ready to hang off an input. */
  readonly fieldErrors: Record<string, string>;
  /** Whatever else the domain error attached — the payload a 409 uses to tell
   *  the UI *which* existing record it collided with. */
  readonly context: Record<string, unknown>;

  constructor(status: number, body: ProblemBody, fallback: string) {
    const issues = (body.context?.issues ?? []).filter(
      (i): i is ProblemIssue => typeof i?.message === 'string',
    );
    super(summarizeIssues(issues, body.detail ?? fallback));
    this.name = 'ApiError';
    this.status = status;
    this.type = body.type ?? '';
    this.title = body.title ?? fallback;
    this.detail = body.detail ?? fallback;
    this.issues = issues;
    this.context = body.context ?? {};
    this.fieldErrors = Object.fromEntries(
      // First issue per field wins — later ones are usually the same cause.
      issues
        .filter((i) => i.path)
        .map((i) => [i.path, i.message])
        .reverse(),
    );
  }
}

/** Builds an ApiError from a failed Response; never throws while parsing. */
export async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as ProblemBody;
  return new ApiError(res.status, body, `${fallback}: ${res.status}`);
}

/**
 * Field errors from a local zod `safeParse` failure, in the same shape as
 * `ApiError.fieldErrors` — so a form renders client- and server-side errors
 * through one code path.
 */
export function zodFieldErrors(error: {
  issues: { path: (string | number)[]; message: string }[];
}): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((i) => [i.path.join('.'), i.message]).reverse(),
  );
}

/** One-line summary of a local zod failure, matching the API's toast wording. */
export function zodSummary(
  error: { issues: { path: (string | number)[]; message: string }[] },
  fallback: string,
): string {
  return summarizeIssues(
    error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    fallback,
  );
}
