import { redirect } from 'next/navigation';

// The audit log viewer now lives at /audit (Slice 2).
export default function AuditLogRedirect(): never {
  redirect('/audit');
}
