'use client';

import {
  Button,
  CommandPalette,
  Sidebar,
  Topbar,
  type CommandRoute,
  type NavItem,
} from '@/components/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { NAV_GROUPS, VENDOR_LIVE_ROUTES } from '@/vendor/config/nav';
import { refreshAccessToken } from '@/vendor/lib/api-client';
import { useSessionStore } from '@/vendor/store/session-store';
import { useVendorUiStore } from '@/vendor/store/ui-store';

const LOGOUT_HREF = 'action:logout';

export function VendorShell({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useSessionStore();
  const { sidebarCollapsed, commandOpen, toggleSidebar, setCommandOpen } =
    useVendorUiStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Navigating from the drawer should close it; otherwise the new page renders
  // behind an overlay that is still up.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Verify the session is still valid on load; the vendor shell reads no
  // tenanted API in Slice 0, so we only refresh the token, not a profile.
  //
  // Through the shared single-flight refresher: a raw fetch here raced the
  // portal's own 401-driven refresh, and since the refresh token rotates the
  // loser was told the session had ended. See app-shell.tsx for the same fix.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const accessToken = await refreshAccessToken();
      if (!accessToken && !cancelled) router.replace('/vendor/login');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Cmd-K / Ctrl-K opens the command palette, same as the buyer portal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCommandOpen]);

  const logout = useCallback(async () => {
    await fetch(`/api/vendor/auth/logout`, { method: 'POST' });
    clear();
    router.replace('/vendor/login');
  }, [clear, router]);

  const commandRoutes: CommandRoute[] = [
    ...VENDOR_LIVE_ROUTES,
    { label: 'Logout', href: LOGOUT_HREF, keywords: 'sign out log out' },
  ];

  const onCommandSelect = (href: string): void => {
    if (href === LOGOUT_HREF) void logout();
    else router.push(href);
  };

  const renderLink = (item: NavItem, content: ReactNode): ReactNode => (
    <Link href={item.href}>{content}</Link>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <a href="#vendor-main" className="pf-skip-link">
        Skip to content
      </a>

      <Sidebar
        brand={
          <div className="flex items-center gap-2">
            {/* Gold badge and on-navy text: the rail is navy, so the
                ink-on-white treatment this shell carried was invisible. */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-gold text-navy">
              <span className="font-numeric text-[12px] font-bold">P</span>
            </span>
            {(!sidebarCollapsed || mobileNavOpen) && (
              <span className="text-[14px] font-semibold tracking-heading text-on-navy">
                Vendor Portal
              </span>
            )}
          </div>
        }
        groups={NAV_GROUPS}
        activeHref={pathname}
        collapsed={sidebarCollapsed}
        renderLink={renderLink}
        // Below `lg` the rail is off-canvas, so the topbar hamburger opens it.
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          title="Supplier"
          onToggleSidebar={toggleSidebar}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          right={
            <div className="flex items-center gap-2 pl-1">
              <span className="hidden text-[12px] text-on-navy-muted sm:inline">
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

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        routes={commandRoutes}
        onSelect={onCommandSelect}
      />
    </div>
  );
}
