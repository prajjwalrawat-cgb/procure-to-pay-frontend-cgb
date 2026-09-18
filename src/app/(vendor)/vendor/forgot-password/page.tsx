'use client';

import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { API_URL } from '@/vendor/lib/env';

export default function VendorForgotPasswordPage(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        // The portal decides which sign-in page the emailed link returns to.
        headers: { 'Content-Type': 'application/json', 'x-portal': 'vendor' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.detail ?? 'Could not send the reset link.');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-white">
            <span className="font-numeric text-[13px] font-bold">P</span>
          </span>
          <span className="text-[16px] font-semibold tracking-heading text-ink">
            Supplier Portal
          </span>
        </div>

        {sent ? (
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Check your email</h2>
            <p className="mt-2 text-[13px] text-muted">
              If a supplier account exists for <span className="text-text">{email}</span>,
              a reset link is on its way. It is valid for one hour.
            </p>
            <p className="mt-2 text-[12px] text-faint">
              Nothing arrived? Check spam, or try again in a few minutes.
            </p>
            <Link
              href="/vendor/login"
              className="text-accent mt-4 inline-block text-[13px] hover:underline"
            >
              Back to sign in →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-[16px] font-semibold text-ink">Forgot your password?</h2>
            <p className="mt-1 text-[13px] text-muted">
              Enter the email you sign in with and we will send you a link to set a new
              password.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[12px] font-medium text-text">
                Email
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              {error && (
                <p className="rounded-sm bg-danger-wash px-2.5 py-2 text-[12px] text-danger">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="mt-1 w-full"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
            <Link
              href="/vendor/login"
              className="mt-4 inline-block text-[12px] text-muted hover:underline"
            >
              ← Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
