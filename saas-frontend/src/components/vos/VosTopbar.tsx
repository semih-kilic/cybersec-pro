import { useLocation, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { Bell, Menu, Search, ChevronRight } from 'lucide-react';
import { VosUserMenu } from './VosUserMenu';
import { cn } from '../../lib/cn';

/**
 * VosTopbar — sticky glass top bar.
 *
 *   • Mobile menu toggle (hidden on lg+)
 *   • Auto-generated breadcrumb from URL pathname
 *   • Inline search trigger (⌘K)
 *   • Notifications + user dropdown menu
 */
export function VosTopbar({
  user,
  onSearch,
  onMenu,
  onLogout,
  onShortcuts,
}: {
  user?: { name?: string; email?: string; avatarUrl?: string; role?: string; plan?: string };
  onSearch?: () => void;
  onMenu?: () => void;
  onLogout?: () => void;
  onShortcuts?: () => void;
}) {
  const { pathname } = useLocation();

  const crumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((p, i) => {
      const to = '/' + parts.slice(0, i + 1).join('/');
      const label = decodeURIComponent(p)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      return { to, label };
    });
  }, [pathname]);

  return (
    <header
      className={cn(
        'sticky top-0 z-vos-sticky',
        'h-vos-topbar flex items-center gap-vos-4 px-vos-4 lg:px-vos-6',
        'vos-topbar-surface',
      )}
    >
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="lg:hidden vos-btn vos-btn-ghost vos-btn-icon"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-vos-sm min-w-0">
        {crumbs.length === 0 ? (
          <span className="text-vos-text-3">Home</span>
        ) : (
          crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={c.to} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <ChevronRight size={14} className="text-vos-text-muted shrink-0" />}
                {isLast ? (
                  <span className="text-vos-text font-medium truncate">{c.label}</span>
                ) : (
                  <Link
                    to={c.to}
                    className="text-vos-text-3 hover:text-vos-text-2 truncate transition-colors"
                  >
                    {c.label}
                  </Link>
                )}
              </span>
            );
          })
        )}
      </nav>

      <div className="flex-1" />

      {/* Search */}
      <button
        type="button"
        onClick={onSearch}
        className={cn(
          'hidden md:flex items-center gap-vos-2 px-vos-3 h-9',
          'vos-glass-1 rounded-vos-md border border-vos-border-2',
          'text-vos-sm text-vos-text-3 hover:text-vos-text-2 hover:border-vos-border-3',
          'transition-colors duration-vos-2 min-w-[260px]',
        )}
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="text-vos-2xs font-mono px-1.5 py-0.5 rounded bg-vos-glass-2 border border-vos-border-2">
          ⌘K
        </kbd>
      </button>

      {/* Mobile search icon */}
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className="md:hidden vos-btn vos-btn-ghost vos-btn-icon"
      >
        <Search size={18} />
      </button>

      {/* Notifications */}
      <button
        type="button"
        aria-label="Notifications"
        className="relative vos-btn vos-btn-ghost vos-btn-icon"
      >
        <Bell size={18} />
        <span className="absolute top-2 right-2 size-1.5 rounded-full bg-vos-danger" />
      </button>

      {/* User dropdown menu */}
      <VosUserMenu user={user} onLogout={onLogout} onShortcuts={onShortcuts} />
    </header>
  );
}
