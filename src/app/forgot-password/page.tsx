'use client';

import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { API_URL } from '@/lib/env';

export default function ForgotPasswordPage(): React.JSX.Element {
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
        headers: { 'Content-Type': 'application/json', 'x-portal': 'buyer' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.detail ?? 'Could not send the reset link.');
      }
      // The API answers the same way whether or not the address has an account,
      // so the confirmation must not claim an email was actually sent.
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
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-white">
            <span className="font-numeric text-body-sm font-bold">P</span>
          </span>
          <span className="text-h3 font-semibold tracking-heading text-ink">
            ProcureFlow
          </span>
        </div>

        {sent ? (
          <div>
            <h2 className="text-h3 font-semibold text-ink">Check your email</h2>
            <p className="mt-2 text-body-sm text-muted">
              If an account exists for <span className="text-text">{email}</span>, a reset
              link is on its way. It is valid for one hour.
            </p>
            <p className="mt-2 text-caption text-faint">
              Nothing arrived? Check spam, or try again in a few minutes.
            </p>
            <Link
              href="/login"
              className="text-accent mt-4 inline-block text-body-sm hover:underline"
            >
              Back to sign in →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-h3 font-semibold text-ink">Forgot your password?</h2>
            <p className="mt-1 text-body-sm text-muted">
              Enter your work email and we will send you a link to set a new one.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-caption font-medium text-text">
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
                <p className="rounded-sm bg-danger-wash px-2.5 py-2 text-caption text-danger">
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
              href="/login"
              className="mt-4 inline-block text-caption text-muted hover:underline"
            >
              ← Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
