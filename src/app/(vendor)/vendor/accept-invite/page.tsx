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

  if (done) {
    return (
      <div className="mx-auto mt-24 max-w-[440px] px-4 text-center">
        <h1 className="text-ink text-h2 font-semibold">You&apos;re all set</h1>
        <p className="text-muted mt-2 text-body-sm">
          Your password has been set. Sign in to complete your onboarding profile.
        </p>
        <Link
          href="/vendor/login"
          className="text-accent mt-4 inline-block text-body-sm hover:underline"
        >
          Go to sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-[440px] px-4">
      <h1 className="text-ink text-h2 font-semibold">Accept your invitation</h1>
      <p className="text-muted mt-1 text-body-sm">
        Set a password for your vendor account. You&apos;ll complete a short onboarding
        wizard after signing in.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
          <label className="text-muted mb-1 block text-caption font-medium">
            New password
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-caption font-medium">
            Confirm password
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-danger text-caption">{error}</p>}
        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? 'Setting password…' : 'Set password & continue'}
        </Button>
      </form>
      <Link
        href="/vendor/login"
        className="text-muted mt-4 inline-block text-caption hover:underline"
      >
        Already have access? Sign in
      </Link>
    </div>
  );
}
