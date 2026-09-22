import { redirect } from 'next/navigation';

// The approval matrix builder lives at /approvals; this keeps old links working.
export default function ApprovalMatrixRedirect(): never {
  redirect('/approvals');
}
