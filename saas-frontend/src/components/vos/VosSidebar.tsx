import { type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface VosNavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  badge?: ReactNode;
  external?: boolean;
  /** Optional section heading shown ABOVE this item */
  section?: string;
}

export function VosSidebar({
  nav,
  bottomNav,
  brand,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: {
  nav: VosNavItem[];
  bottomNav?: VosNavItem[];
  brand: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const location = useLocation();

  return (
    <aside
      role="navigation"
      aria-label="Primary"
      className={cn(
        'fixed left-0 top-0 h-screen z-vos-overlay flex flex-col',
        'border-r border-vos-border-1',
        'transition-[width,transform] duration-vos-2 ease-vos-out',
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
          className="size-8 rounded-vos-sm flex items-center justify-center shrink-0"
          style={{
            background: 'var(--vos-accent)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 2L3 7v6c0 5 3.8 9.5 9 11 5.2-1.5 9-6 9-11V7l-9-5z"
              fill="white"
            />
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
        {nav.map((item, i) => (
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

        {bottomNav && bottomNav.length > 0 && (
          <>
            <div className="vos-divider my-vos-3" />
            {bottomNav.map((item, i) => (
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
            'transition-colors duration-vos-2',
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
          'transition-colors duration-vos-2 ease-vos-out',
          collapsed && 'justify-center',
        )}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </a>
    );
  }

  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={cn(
        'vos-nav-item group flex items-center gap-vos-3 px-vos-3 py-vos-2.5 rounded-vos-md',
        'text-vos-sm font-medium transition-all duration-vos-2 ease-vos-out',
        isActive
          ? 'vos-nav-item-active'
          : 'text-vos-text-3 hover:text-vos-text hover:bg-vos-glass-2',
        collapsed && 'justify-center',
      )}
    >
      <Icon
        size={18}
        className={cn('shrink-0 transition-transform duration-vos-2', isActive && 'text-vos-accent')}
      />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && <span>{item.badge}</span>}
    </NavLink>
  );
}
