import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationCenter } from '../ui/NotificationCenter';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navigation = [
  { nameKey: 'nav.dashboard', href: '/dashboard', icon: DashboardIcon },
  { nameKey: 'nav.tools', href: '/dashboard/tools', icon: ToolsIcon },
  { nameKey: 'nav.scans', href: '/dashboard/scans', icon: ScansIcon },
  { nameKey: 'nav.targets', href: '/dashboard/targets', icon: TargetsIcon },
  { nameKey: 'nav.reports', href: '/dashboard/reports', icon: ReportsIcon },
  { nameKey: 'nav.schedule', href: '/dashboard/schedule', icon: ScheduleIcon },
  { nameKey: 'nav.projects', href: '/dashboard/projects', icon: ProjectsIcon },
  { nameKey: 'nav.agents', href: '/dashboard/agents', icon: AgentsIcon },
  { nameKey: 'nav.analytics', href: '/dashboard/analytics', icon: AnalyticsIcon },
  { nameKey: 'nav.ai', href: '/dashboard/ai', icon: AIIcon },
  { nameKey: 'nav.purpleTeam', href: '/dashboard/purple-team', icon: PurpleTeamIcon },
  { nameKey: 'nav.terminal', href: '/dashboard/terminal', icon: TerminalIcon },
];

const bottomNav = [
  { nameKey: 'nav.settings', href: '/dashboard/settings', icon: SettingsIcon },
  { nameKey: 'nav.feedback', href: '/dashboard/feedback', icon: FeedbackIcon },
  { nameKey: 'nav.documentation', href: '/docs.html', icon: DocsIcon, external: true },
];

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ScansIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function TargetsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function AIIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function PurpleTeamIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export function Sidebar({ isOpen = false, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { user, organization } = useAuth();
  const { t } = useTranslation();

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  return (
    <aside
      className={`${sidebarWidth} bg-gray-900 border-r border-gray-800 flex flex-col h-screen fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      role="complementary"
      aria-label="Sidebar"
    >
      {/* Logo + Mobile close button */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-kali-blue to-kali-purple flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-white">CyberSec Pro</h1>
                <p className="text-xs text-kali-blue">Security Platform</p>
              </div>
              {/* Notification bell — desktop only (mobile uses top bar) */}
              <div className="hidden lg:block">
                <NotificationCenter />
              </div>
            </>
          )}
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ⌘K Search Hint */}
      {!isCollapsed && (
        <div className="px-4 pt-3">
          <button
            onClick={() => {
              // Trigger ⌘K palette by simulating keyboard event
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
            }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 hover:text-gray-300 hover:border-gray-600 hover:bg-gray-800 transition text-sm"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="flex-1 text-left">Search...</span>
            <kbd className="text-xs bg-gray-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {!isCollapsed && <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t('nav.main')}</div>}
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
          return (
            <NavLink
              key={item.nameKey}
              to={item.href}
              onClick={onClose}
              title={isCollapsed ? t(item.nameKey) : undefined}
              className={`flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-kali-blue/20 text-kali-blue border-l-2 border-kali-blue'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <item.icon />
              {!isCollapsed && t(item.nameKey)}
              {!isCollapsed && item.nameKey === 'nav.scans' && (
                <span className="ml-auto px-2 py-0.5 text-xs bg-kali-blue/20 text-kali-blue rounded-full">
                  Live
                </span>
              )}
            </NavLink>
          );
        })}

        <div className="border-t border-gray-800 my-4" />
        {!isCollapsed && <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t('nav.system')}</div>}
        {!isCollapsed && <LanguageSwitcher variant="sidebar" />}
        {!isCollapsed && <ThemeToggle />}
        {bottomNav.map((item) => (
          <NavLink
            key={item.nameKey}
            to={item.href}
            target={item.external ? '_blank' : undefined}
            onClick={!item.external ? onClose : undefined}
            title={isCollapsed ? t(item.nameKey) : undefined}
            className={`flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all`}
          >
            <item.icon />
            {!isCollapsed && t(item.nameKey)}
            {!isCollapsed && item.external && (
              <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            )}
          </NavLink>
        ))}

        {/* Admin God Mode (superadmin only) */}
        {user?.role === 'superadmin' && (
          <NavLink
            to="/dashboard/admin"
            onClick={onClose}
            title={isCollapsed ? 'Admin' : undefined}
            className={`flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-3 rounded-lg text-sm font-medium transition-all ${
              location.pathname === '/dashboard/admin'
                ? 'bg-red-500/20 text-red-400 border-l-2 border-red-400'
                : 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
            }`}
          >
            <AdminIcon />
            {!isCollapsed && (
              <>
                <span>Admin</span>
                <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded font-bold">GOD</span>
              </>
            )}
          </NavLink>
        )}

        {/* Service Manager (superadmin only) */}
        {(user?.role === 'superadmin' || user?.role === 'admin') && (
          <NavLink
            to="/dashboard/service-manager"
            onClick={onClose}
            title={isCollapsed ? 'Services' : undefined}
            className={`flex items-center gap-3 ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-3 rounded-lg text-sm font-medium transition-all ${
              location.pathname === '/dashboard/service-manager'
                ? 'bg-cyan-500/20 text-cyan-400 border-l-2 border-cyan-400'
                : 'text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            {!isCollapsed && (
              <>
                <span>Services</span>
                <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded font-bold">RUST</span>
              </>
            )}
          </NavLink>
        )}

        {/* Upgrade Banner for non-enterprise users */}
        {!isCollapsed && organization?.plan_type !== 'enterprise' && (
          <NavLink
            to="/dashboard/upgrade"
            className="mt-4 flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-kali-blue/20 to-purple-500/20 text-kali-blue hover:from-kali-blue/30 hover:to-purple-500/30 transition-all border border-kali-blue/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {t('nav.upgradePlan')}
          </NavLink>
        )}
      </nav>

      {/* Collapse Toggle — desktop only */}
      <div className="hidden lg:block px-3 py-2 border-t border-gray-800">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition text-sm"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-800">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-lg bg-gray-800/50 hover:bg-gray-800 transition cursor-pointer`}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kali-blue to-kali-purple flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
            </div>
          )}
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-400 truncate">{organization?.plan_type?.toUpperCase()}</p>
              </div>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
