import { type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface VosNavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number | string }>;
  badge?: ReactNode;
  external?: boolean;
  section?: string;
  roles?: Array<'user' | 'admin' | 'superadmin'>;
  cta?: boolean;
}

export function VosSidebar({
  nav,
  bottomNav,
  brand,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  userRole,
}: {
  nav: VosNavItem[];
  bottomNav?: VosNavItem[];
  brand: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  userRole?: string;
}) {
  const location = useLocation();

  const canSee = (item: VosNavItem) =>
    !item.roles || item.roles.length === 0 || (userRole && item.roles.includes(userRole as any));

  const visibleNav = nav.filter(canSee);
  const visibleBottomNav = (bottomNav ?? []).filter(canSee);

  return (
    <aside
      role="navigation"
      aria-label="Primary"
      className={cn(
        'fixed left-0 top-0 h-screen z-vos-overlay flex flex-col',
        'border-r border-vos-border-1',
        'transition-[width,transform] duration-200 ease-out',
        'lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{
        width: collapsed ? 'var(--vos-sidebar-w-collapsed)' : 'var(--vos-sidebar-w)',
        background: 'var(--vos-bg-elev-1)',
        boxShadow: 'inset -1px 0 0 0 var(--vos-border-1)',
      }}
    >
      {/* Brand row */}
      <div className="h-vos-topbar flex items-center gap-vos-3 px-vos-4 border-b border-vos-border-1">
        <div
          className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105 shadow-md shadow-cyan-500/20 bg-gradient-to-r from-cyan-500 to-blue-500"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-vos-md font-semibold tracking-vos-snug truncate text-vos-text">{brand}</div>
            <div className="text-vos-2xs text-vos-text-muted truncate">Security Platform</div>
          </div>
        )}
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close menu"
          className="lg:hidden vos-btn vos-btn-ghost vos-btn-icon shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav scroll area */}
      <nav className="flex-1 overflow-y-auto vos-scrollbar px-vos-2 py-vos-3 space-y-0.5">
        {visibleNav.map((item, i) => (
          <div key={item.to + i}>
            {item.section && !collapsed && (
              <div className="vos-nav-section">{item.section}</div>
            )}
            {item.section && collapsed && i > 0 && (
              <div className="vos-divider mx-vos-2 my-vos-2" />
            )}
            <NavRow
              item={item}
              collapsed={collapsed}
              currentPath={location.pathname}
            />
          </div>
        ))}

        {visibleBottomNav.length > 0 && (
          <>
            <div className="vos-divider my-vos-3" />
            {visibleBottomNav.map((item, i) => (
              <NavRow
                key={'b' + item.to + i}
                item={item}
                collapsed={collapsed}
                currentPath={location.pathname}
              />
            ))}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-vos-border-1 p-vos-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'w-full flex items-center gap-vos-2 px-vos-3 py-vos-2 rounded-vos-md',
            'text-vos-text-3 hover:text-vos-text hover:bg-vos-glass-2',
            'transition-all duration-200',
          )}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && <span className="text-vos-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function NavRow({
  item,
  collapsed,
  currentPath,
}: {
  item: VosNavItem;
  collapsed: boolean;
  currentPath: string;
}) {
  const isActive =
    currentPath === item.to ||
    (item.to !== '/dashboard' && currentPath.startsWith(item.to + '/')) ||
    (item.to !== '/dashboard' && currentPath.startsWith(item.to));

  const Icon = item.icon;

  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noreferrer"
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex items-center gap-vos-3 px-vos-3 py-vos-2.5 rounded-vos-md',
          'text-vos-sm font-medium text-vos-text-3 hover:text-vos-text hover:bg-vos-glass-2',
          'transition-all duration-200',
          collapsed && 'justify-center',
        )}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </a>
    );
  }

  if (item.cta) {
    return (
      <NavLink
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group flex items-center gap-vos-3 px-vos-3 py-vos-2.5 rounded-vos-md',
          'text-vos-sm font-semibold transition-all duration-200',
          'bg-vos-accent text-white hover:bg-vos-accent-2',
          collapsed && 'justify-center',
        )}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={cn(
        'vos-nav-item group flex items-center gap-vos-3 px-vos-3 py-vos-2.5 rounded-vos-md',
        'text-vos-sm font-medium transition-all duration-200',
        isActive
          ? 'vos-nav-item-active'
          : 'text-vos-text-3 hover:text-vos-text hover:bg-vos-glass-2',
        collapsed && 'justify-center',
      )}
    >
      <Icon
        size={18}
        className={cn('shrink-0 transition-colors duration-200', isActive && 'text-vos-accent')}
      />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && <span>{item.badge}</span>}
    </NavLink>
  );
}
