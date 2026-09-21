'use client';

import {
  Button,
  Input,
  controlClass,
} from '@/components/ui';
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

  if (done) {
    return (
      <div className="mx-auto mt-24 max-w-[440px] px-4 text-center">
        <h1 className="text-ink text-h2 font-semibold">Registration received</h1>
        <p className="text-muted mt-2 text-body-sm">
          We&apos;ve created your vendor account. A temporary password (
          <code>Slice0!Vendor</code>) has been set — sign in and complete your onboarding
          profile.
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
      <h1 className="text-ink text-h2 font-semibold">Become a vendor</h1>
      <p className="text-muted mt-1 text-body-sm">
        Register your business to start supplying. You&apos;ll complete a short onboarding
        wizard after signing in.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
          <label className="text-muted mb-1 block text-caption font-medium">
            Legal entity name
          </label>
          <Input
            value={legalEntityName}
            onChange={(e) => setLegalEntityName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-caption font-medium">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-caption font-medium">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div>
          <label className="text-muted mb-1 block text-caption font-medium">
            Category
          </label>
          <select
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            className={controlClass}
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-danger text-caption">{error}</p>}
        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? 'Registering…' : 'Register'}
        </Button>
      </form>
      <Link
        href="/vendor/login"
        className="text-muted mt-4 inline-block text-caption hover:underline"
      >
        Already registered? Sign in
      </Link>
    </div>
  );
}
