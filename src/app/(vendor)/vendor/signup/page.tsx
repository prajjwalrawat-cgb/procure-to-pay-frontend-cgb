'use client';

import { Button, Input, Select } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { API_URL } from '@/vendor/lib/env';

interface CategoryOption {
  key: string;
  displayName: string;
  slaHours: number;
}

export default function VendorSignupPage(): React.JSX.Element {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [legalEntityName, setLegalEntityName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  // Tenant is carried by the buyer-issued registration link (?tenant=<id>);
  // read client-side. Without it the public endpoint rejects the signup.
  const [tenantId, setTenantId] = useState('');

  useEffect(() => {
    setTenantId(new URLSearchParams(window.location.search).get('tenant') ?? '');
  }, []);

  // Waits for the tenant: the categories offered are that organisation's own.
  useEffect(() => {
    if (!tenantId) return;
    void fetch(`${API_URL}/public/vendors/categories?tenant=${encodeURIComponent(tenantId)}`)
      .then((r) => r.json())
      .then((cats: CategoryOption[]) => {
        setCategories(cats);
        setCategoryKey(cats[0]?.key ?? '');
      })
      .catch(() => setCategories([]));
  }, [tenantId]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!tenantId) {
      setError(
        'This registration link is missing its organisation. Please use the link your buyer shared with you.',
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/public/vendors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          legalEntityName,
          email,
          phone,
          categoryKey,
          captchaResponse: 'demo-captcha',
        }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.detail ?? 'Registration failed');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

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
            <h2 className="text-h3 font-semibold text-ink">Registration received</h2>
            {/* The API really does set this temporary password on self-registration
                (vendor-onboarding.service), so the supplier has to be told it. */}
            <p className="mt-2 text-body-sm text-muted">
              We&apos;ve created your vendor account with the temporary password{' '}
              <code className="font-numeric text-text">Slice0!Vendor</code>. Sign in and
              complete your onboarding profile.
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
            <h2 className="text-h3 font-semibold text-ink">Become a vendor</h2>
            <p className="mt-1 text-body-sm text-muted">
              Register your business to start supplying. You&apos;ll complete a short
              onboarding wizard after signing in.
            </p>
            <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-caption font-medium text-text">
                Legal entity name
                <Input
                  value={legalEntityName}
                  onChange={(e) => setLegalEntityName(e.target.value)}
                  autoComplete="organization"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-caption font-medium text-text">
                Email
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-caption font-medium text-text">
                Phone
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-caption font-medium text-text">
                Category
                <Select value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.displayName}
                    </option>
                  ))}
                </Select>
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
                {loading ? 'Registering…' : 'Register'}
              </Button>
            </form>
            <Link
              href="/vendor/login"
              className="mt-4 inline-block text-caption text-muted hover:underline"
            >
              Already registered? Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
