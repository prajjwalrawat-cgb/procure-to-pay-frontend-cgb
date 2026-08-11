'use client';

import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { safeNextPath } from '@/lib/auth-session';
import { useSessionStore } from '@/store/session-store';

interface LoginResult {
  user: { id: string; email: string; name: string; roles: string[]; mfaEnabled: boolean };
  accessToken: string;
  mfaRequired: boolean;
}

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as LoginResult & { detail?: string };
      if (!res.ok) {
        setError(data.detail ?? 'Invalid credentials');
        return;
      }
      if (data.mfaRequired) {
        setError('MFA is enabled for this account (not exercised in Slice 0 demo).');
        return;
      }
      setSession(data.accessToken, data.user);
      // Return the user to whatever an expired session interrupted — read at
      // submit time rather than via useSearchParams, which would opt this page
      // out of static rendering and require a Suspense boundary.
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(safeNextPath(next, '/'));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-canvas flex min-h-screen items-center justify-center px-4">
      <div className="border-line bg-panel w-full max-w-sm rounded-xl border p-8 shadow-lg">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span className="bg-ink flex h-7 w-7 items-center justify-center rounded-sm text-white">
              <span className="font-numeric text-[13px] font-bold">P</span>
            </span>
            <span className="tracking-heading text-ink text-[16px] font-semibold">
              ProcureFlow
            </span>
          </div>
          <p className="text-muted mt-2 text-[13px]">Sign in to the buyer portal.</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
            Email
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="harpreet@star-cement.example"
              required
            />
          </label>
          <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
            Password
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-muted mt-4 text-center text-[12px]">
          Are you a supplier?{' '}
          <Link href="/vendor/login" className="text-brand hover:underline">
            Vendor sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
