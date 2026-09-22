'use client';

import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { API_URL } from '@/vendor/lib/env';

export default function AcceptInvitePage(): React.JSX.Element {
  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // The magic link carries both the secret token and the tenant it belongs to.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
    setTenantId(params.get('tenant') ?? '');
  }, []);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!token || !tenantId) {
      setError('This invitation link is invalid or incomplete. Please use the link from your email.');
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
      const res = await fetch(`${API_URL}/public/vendors/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tenantId, password }),
      });
      if (!res.ok) {
        const problem = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(problem.detail ?? 'Could not accept the invitation.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation.');
    } finally {
      setLoading(false);
    }
  }

  // Same centred card as the other supplier sign-in screens, so a supplier
  // arriving from the invitation email lands on something that looks like the
  // portal they are about to use.
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-white">
            <span className="font-numeric text-body-sm font-bold">P</span>
          </span>
          <span className="text-h3 font-semibold tracking-heading text-ink">
            Supplier Portal
          </span>
        </div>

        {done ? (
          <div>
            <h2 className="text-h3 font-semibold text-ink">You&apos;re all set</h2>
            <p className="mt-2 text-body-sm text-muted">
              Your password has been set. Sign in to complete your onboarding profile.
            </p>
            <Link
              href="/vendor/login"
              className="text-accent mt-4 inline-block text-body-sm hover:underline"
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-h3 font-semibold text-ink">Accept your invitation</h2>
            <p className="mt-1 text-body-sm text-muted">
              Set a password for your vendor account. You&apos;ll complete a short
              onboarding wizard after signing in.
            </p>
            <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-caption font-medium text-text">
                New password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-caption font-medium text-text">
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
                <p
                  role="alert"
                  className="rounded-sm bg-danger-wash px-2.5 py-2 text-caption text-danger"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="mt-1 w-full"
              >
                {loading ? 'Setting password…' : 'Set password & continue'}
              </Button>
            </form>
            <Link
              href="/vendor/login"
              className="mt-4 inline-block text-caption text-muted hover:underline"
            >
              Already have access? Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
