'use client';

import { Button, Sidebar, Topbar, type NavItem } from '@/components/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { NAV_GROUPS } from '@/vendor/config/nav';
import { useSessionStore } from '@/vendor/store/session-store';

export function VendorShell({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useSessionStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Navigating from the drawer should close it; otherwise the new page renders
  // behind an overlay that is still up.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
      <a href="#vendor-main" className="pf-skip-link">
        Skip to content
      </a>

      <Sidebar
        brand={
          <div className="flex items-center gap-2">
            {/* Gold badge and on-navy text: the rail is navy, so the buyer
                shell's ink-on-white treatment was invisible here. */}
            <span className="bg-gold text-navy flex h-6 w-6 items-center justify-center rounded-sm">
              <span className="font-numeric text-[12px] font-bold">P</span>
            </span>
            <span className="tracking-heading text-on-navy text-[14px] font-semibold">
              Vendor Portal
            </span>
          </div>
        }
        groups={NAV_GROUPS}
        activeHref={pathname}
        renderLink={renderLink}
        // Below `lg` the rail is off-canvas. Without this wiring the vendor
        // portal had a hamburger that did nothing and no reachable navigation
        // at all on a phone.
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          title="Supplier"
          onOpenMobileNav={() => setMobileNavOpen(true)}
          right={
            <div className="flex items-center gap-2 pl-1">
              <span className="text-on-navy-muted hidden text-[12px] sm:inline">
                {user?.name ?? 'Vendor'}
              </span>
              <Button variant="onNavy" size="sm" onClick={() => void logout()}>
                Logout
              </Button>
            </div>
          }
        />
        <main id="vendor-main" className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
