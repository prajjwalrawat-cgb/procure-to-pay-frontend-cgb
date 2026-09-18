'use client';

import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { safeNextPath } from '@/lib/auth-session';
import { SESSION_ENDED_PARAM } from '@/lib/session-ended';
import { useSessionStore } from '@/vendor/store/session-store';

interface LoginResult {
  user: { id: string; email: string; name: string; roles: string[] };
  accessToken: string;
  mfaRequired: boolean;
  detail?: string;
}

export default function VendorLoginPage(): React.JSX.Element {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /*
   * The session ended under them rather than them arriving here by choice, so
   * say so — otherwise an expiry looks like the app randomly logging them out.
   * Read once on mount (not via useSearchParams, which would opt this page out
   * of static rendering) and dropped as soon as they start typing.
   */
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).has(SESSION_ENDED_PARAM));
  }, []);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setExpired(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as LoginResult;
      if (!res.ok) {
        // A server fault carries no `detail` (problem+json hides internals), so
        // falling back to "Invalid credentials" would blame the supplier for an
        // outage and send them round the password-reset loop for nothing.
        setError(
          data.detail ??
            (res.status >= 500
              ? 'Sign-in is temporarily unavailable. Please try again in a moment.'
              : 'Invalid credentials'),
        );
        return;
      }
      setSession(data.accessToken, data.user);
      // Return the vendor to whatever an expired session interrupted — read at
      // submit time rather than via useSearchParams, which would opt this page
      // out of static rendering and require a Suspense boundary.
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(safeNextPath(next, '/vendor'));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Emerald-gradient hero signals the supplier side (Slice 0 spec). */}
      <div className="bg-accent relative hidden overflow-hidden lg:block">
        <div className="from-accent via-accent-2 to-ink absolute inset-0 bg-gradient-to-br opacity-95" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-white/15">
              <span className="font-numeric text-[13px] font-bold">P</span>
            </span>
            <span className="tracking-heading text-[16px] font-semibold">
              ProcureFlow
            </span>
          </div>
          <div>
            <h1 className="tracking-heading max-w-sm text-[28px] font-semibold leading-tight">
              Supplier Portal
            </h1>
            <p className="mt-3 max-w-sm text-[14px] text-white/80">
              Submit invoices, track purchase orders, and manage your documents with your
              buyers.
            </p>
          </div>
          <p className="text-[12px] text-white/60">Separate, secure supplier access.</p>
        </div>
      </div>

      <div className="bg-canvas flex items-center justify-center px-4">
        <div className="border-line bg-panel w-full max-w-sm rounded-xl border p-8 shadow-lg">
          <h2 className="tracking-heading text-ink text-[16px] font-semibold">
            Vendor sign in
          </h2>
          <p className="text-muted mt-1 text-[13px]">Access your supplier account.</p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
            <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
              Email
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kalpesh@patel-eng.example"
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
            <Link
              href="/vendor/forgot-password"
              className="text-muted -mt-1 self-end text-[12px] hover:underline"
            >
              Forgot password?
            </Link>

            {expired && !error && (
              <p className="bg-warn-wash text-warn rounded-sm px-2.5 py-2 text-[12px]">
                Your session expired. Please sign in again.
              </p>
            )}

            {error && (
              <p className="bg-danger-wash text-danger rounded-sm px-2.5 py-2 text-[12px]">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="mt-1 w-full"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-muted mt-4 text-center text-[12px]">
            Are you a buyer?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Buyer sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
