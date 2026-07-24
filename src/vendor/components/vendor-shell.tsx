'use client';

import { Button, Sidebar, Topbar, type NavItem } from '@/components/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { NAV_GROUPS } from '@/vendor/config/nav';
import { useSessionStore } from '@/vendor/store/session-store';

export function VendorShell({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useSessionStore();

  // Verify the session is still valid on load; the vendor shell reads no
  // tenanted API in Slice 0, so we only refresh the token, not a profile.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const refreshed = await fetch(`/api/vendor/auth/refresh`, { method: 'POST' });
      if (!refreshed.ok && !cancelled) router.replace('/vendor/login');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const logout = async (): Promise<void> => {
    await fetch(`/api/vendor/auth/logout`, { method: 'POST' });
    clear();
    router.replace('/vendor/login');
  };

  const renderLink = (item: NavItem, content: ReactNode): ReactNode => (
    <Link href={item.href}>{content}</Link>
  );

  return (
    <div className="bg-paper flex h-screen overflow-hidden">
      <Sidebar
        brand={
          <div className="flex items-center gap-2">
            <span className="bg-accent flex h-6 w-6 items-center justify-center rounded-sm text-white">
              <span className="font-numeric text-[12px] font-bold">P</span>
            </span>
            <span className="tracking-heading text-ink text-[14px] font-semibold">
              Vendor Portal
            </span>
          </div>
        }
        groups={NAV_GROUPS}
        activeHref={pathname}
        renderLink={renderLink}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          title="Supplier"
          right={
            <div className="flex items-center gap-2 pl-1">
              <span className="text-muted text-[12px]">{user?.name ?? 'Vendor'}</span>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                Logout
              </Button>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
