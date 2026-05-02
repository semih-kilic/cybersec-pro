import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { VosSidebar, type VosNavItem } from './VosSidebar';
import { VosTopbar } from './VosTopbar';

/**
 * VosAppShell — Vision OS application shell.
 *
 * Layout:
 *   • Fixed mesh-gradient background + subtle grain
 *   • Left glass sidebar (collapsible, persisted)
 *   • Top glass bar (breadcrumb + ⌘K + user)
 *   • Scrollable content region in `<main>`
 *
 * Persists the sidebar collapsed state in localStorage under "vos:sidebar:collapsed".
 *
 *   <VosAppShell nav={NAV} bottomNav={BOTTOM} user={user}>
 *     <Outlet />  // or any route content
 *   </VosAppShell>
 */
export function VosAppShell({
  nav,
  bottomNav,
  brand = 'CyberSec Pro',
  user,
  onSearch,
  onLogout,
  onShortcuts,
  children,
}: {
  nav: VosNavItem[];
  bottomNav?: VosNavItem[];
  brand?: string;
  user?: { name?: string; email?: string; avatarUrl?: string; role?: string; plan?: string };
  onSearch?: () => void;
  onLogout?: () => void;
  onShortcuts?: () => void;
  children: ReactNode;
}) {
  const location = useLocation();
  // Collapse state persisted in localStorage.
  const initial =
    typeof window !== 'undefined' &&
    window.localStorage.getItem('vos:sidebar:collapsed') === '1';
  const [collapsed, setCollapsed] = useStateWithLS(initial);

  // Mobile drawer open
  const [mobileOpen, setMobileOpen] = useStateBool(false);

  // Close drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div data-vos-app="" className="vos-root min-h-screen relative">
      {/* Solid black canvas — apple.com style. No mesh, no aurora. */}
      <div className="vos-bg-canvas" aria-hidden />

      {/* Sidebar (fixed) */}
      <VosSidebar
        nav={nav}
        bottomNav={bottomNav}
        brand={brand}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        userRole={user?.role}
      />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-vos-overlay bg-black/40 backdrop-blur-sm"
        />
      )}

      {/* Main column shifted by sidebar width on lg+ */}
      <div
        className="flex flex-col min-h-screen transition-[padding] duration-vos-2 ease-vos-out"
        style={{ paddingLeft: 0 }}
      >
        <div
          className="hidden lg:block"
          style={{
            // CSS-driven shift — uses the same tokens the sidebar reads
            paddingLeft: collapsed
              ? 'var(--vos-sidebar-w-collapsed)'
              : 'var(--vos-sidebar-w)',
            transition: 'padding-left var(--vos-dur-2) var(--vos-ease-out)',
          }}
        >
          <ShellInner
            user={user}
            onSearch={onSearch}
            onLogout={onLogout}
            onShortcuts={onShortcuts}
            onMenu={() => setMobileOpen(true)}
          >
            {children}
          </ShellInner>
        </div>
        {/* Mobile (no padding shift) */}
        <div className="lg:hidden">
          <ShellInner
            user={user}
            onSearch={onSearch}
            onLogout={onLogout}
            onShortcuts={onShortcuts}
            onMenu={() => setMobileOpen(true)}
          >
            {children}
          </ShellInner>
        </div>
      </div>
    </div>
  );
}

function ShellInner({
  children,
  user,
  onSearch,
  onLogout,
  onShortcuts,
  onMenu,
}: {
  children: ReactNode;
  user?: { name?: string; email?: string; avatarUrl?: string; role?: string; plan?: string };
  onSearch?: () => void;
  onLogout?: () => void;
  onShortcuts?: () => void;
  onMenu: () => void;
}) {
  return (
    <>
      <VosTopbar user={user} onSearch={onSearch} onLogout={onLogout} onShortcuts={onShortcuts} onMenu={onMenu} />
      <main className="flex-1 px-vos-4 lg:px-vos-8 py-vos-6 lg:py-vos-10 relative z-vos-content">
        {children}
      </main>
    </>
  );
}

/* ---------- tiny local hooks (avoid extra files) ---------- */

import { useState } from 'react';
function useStateWithLS(initial: boolean) {
  const [val, setVal] = useState(initial);
  const wrap = (next: boolean | ((p: boolean) => boolean)) => {
    setVal(prev => {
      const v = typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next;
      try { window.localStorage.setItem('vos:sidebar:collapsed', v ? '1' : '0'); } catch {}
      return v;
    });
  };
  return [val, wrap] as const;
}
function useStateBool(initial: boolean) {
  return useState(initial);
}
