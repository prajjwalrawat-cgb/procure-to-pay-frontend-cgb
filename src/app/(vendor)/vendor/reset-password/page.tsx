'use client';

import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { API_URL } from '@/vendor/lib/env';

export default function VendorResetPasswordPage(): React.JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Read the token client-side (avoids the useSearchParams Suspense boundary).
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('This reset link is missing its token. Use the link from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.detail ?? 'Could not reset your password.');
      }
      setDone(true);
      setTimeout(() => router.replace('/vendor/login'), 1500);
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

        {done ? (
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Password changed</h2>
            <p className="mt-2 text-[13px] text-muted">
              You have been signed out everywhere else. Redirecting you to sign in…
            </p>
            <Link
              href="/vendor/login"
              className="text-accent mt-4 inline-block text-[13px] hover:underline"
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-[16px] font-semibold text-ink">Choose a new password</h2>
            <p className="mt-1 text-[13px] text-muted">
              This link works once and expires an hour after it was sent.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[12px] font-medium text-text">
                New password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-text">
                Confirm password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {loading ? 'Saving…' : 'Set new password'}
              </Button>
            </form>
            <Link
              href="/vendor/forgot-password"
              className="mt-4 inline-block text-[12px] text-muted hover:underline"
            >
              Request a new link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
