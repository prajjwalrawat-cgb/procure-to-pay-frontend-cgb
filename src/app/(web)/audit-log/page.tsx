import { redirect } from 'next/navigation';

// The audit log viewer lives at /audit. Document pages still link here with
// ?entityId=…, so the query string is carried across rather than dropped.
export default function AuditLogRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): never {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === 'string') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(query ? `/audit?${query}` : '/audit');
}
