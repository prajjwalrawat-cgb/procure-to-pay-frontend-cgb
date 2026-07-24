'use client';

import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { API_URL } from '@/lib/env';

export default function AcceptInvitePage(): React.JSX.Element {
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
      setError('This invitation link is missing its token. Use the link from your email.');
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
      const res = await fetch(`${API_URL}/users/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.detail ?? 'Could not activate your account.');
      }
      setDone(true);
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-canvas flex min-h-screen items-center justify-center px-4">
      <div className="border-line bg-panel w-full max-w-sm rounded-xl border p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="bg-ink flex h-7 w-7 items-center justify-center rounded-sm text-white">
            <span className="font-numeric text-[13px] font-bold">P</span>
          </span>
          <span className="tracking-heading text-ink text-[16px] font-semibold">
            ProcureFlow
          </span>
        </div>

        {done ? (
          <div>
            <h2 className="text-ink text-[16px] font-semibold">Account activated</h2>
            <p className="text-muted mt-2 text-[13px]">
              Your password is set. Redirecting you to sign in…
            </p>
            <Link
              href="/login"
              className="text-brand mt-4 inline-block text-[13px] hover:underline"
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-ink text-[16px] font-semibold">Set your password</h2>
            <p className="text-muted mt-1 text-[13px]">
              Choose a password to activate your account.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
                New password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
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
                <p className="bg-danger-wash text-danger rounded-sm px-2.5 py-2 text-[12px]">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="accent"
                disabled={loading}
                className="mt-1 w-full"
              >
                {loading ? 'Activating…' : 'Activate account'}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
