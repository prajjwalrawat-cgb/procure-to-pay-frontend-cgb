import { redirect } from 'next/navigation';

// The approval matrix builder now lives at /approvals (Slice 2).
export default function ApprovalMatrixRedirect(): never {
  redirect('/approvals');
}
