import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  Bell,
  Users,
  Key,
  Plug,
  Building2,
  CreditCard,
  Crown,
  Settings as SettingsIcon,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useUtilities';
import {
  ProfileTab,
  SecurityTab,
  NotificationsTab,
  ApiKeysTab,
  TeamTab,
  IntegrationsTab,
  SSOTab,
  BillingTab,
  PurpleTeamProfileTab,
} from './settings';
import type { SettingsMessage } from './settings';
import { PageHeader } from '../../components/vos';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const BASE_TABS = [
  { id: 'profile',       labelKey: 'settings.tabs.profile',       fallback: 'Profile',        icon: User,        description: 'Personal details' },
  { id: 'security',      labelKey: 'settings.tabs.security',      fallback: 'Security',       icon: ShieldCheck, description: 'Authentication & MFA' },
  { id: 'notifications', labelKey: 'settings.tabs.notifications', fallback: 'Notifications',  icon: Bell,        description: 'Email & alerts' },
  { id: 'team',          labelKey: 'settings.tabs.team',          fallback: 'Team',           icon: Users,       description: 'Members & roles' },
  { id: 'api',           labelKey: 'settings.tabs.api',           fallback: 'API keys',       icon: Key,         description: 'Programmatic access' },
  { id: 'integrations',  labelKey: 'settings.tabs.integrations',  fallback: 'Integrations',   icon: Plug,        description: 'Connected services' },
  { id: 'sso',           labelKey: 'settings.tabs.sso',           fallback: 'SSO',            icon: Building2,   description: 'Enterprise sign-on' },
  { id: 'billing',       labelKey: 'settings.tabs.billing',       fallback: 'Billing',        icon: CreditCard,  description: 'Plan & invoices' },
] as const;

const ADMIN_TAB = {
  id: 'purple-profile',
  labelKey: 'settings.tabs.purpleProfile',
  fallback: 'Purple Team Profile',
  icon: Crown as IconType,
  description: 'Operator profile',
} as const;

type BaseTabId = typeof BASE_TABS[number]['id'];
type TabId = BaseTabId | typeof ADMIN_TAB.id;

export default function SettingsPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('settings.title', 'Settings')} — CyberSec Pro`);
  const { user, organization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const userPlan = organization?.plan_type || 'trial';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : [...BASE_TABS];

  const tabParam = searchParams.get('tab');
  const validIds = tabs.map((tt) => tt.id) as readonly string[];
  const initialTab = validIds.includes(tabParam || '') ? (tabParam as TabId) : 'profile';

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setMessage(null);
  }, [setSearchParams]);

  const tabProps = { loading, setLoading, setMessage, user, organization, userPlan };

  const TAB_COMPONENTS: Record<TabId, JSX.Element> = {
    profile:       <ProfileTab {...tabProps} />,
    security:      <SecurityTab {...tabProps} />,
    notifications: <NotificationsTab {...tabProps} />,
    api:           <ApiKeysTab {...tabProps} />,
    team:          <TeamTab {...tabProps} />,
    integrations:  <IntegrationsTab {...tabProps} />,
    sso:           <SSOTab {...tabProps} />,
    billing:       <BillingTab {...tabProps} />,
    'purple-profile': <PurpleTeamProfileTab {...tabProps} />,
  };

  const activeMeta = tabs.find((tt) => tt.id === activeTab);

  return (
    <div className="space-y-vos-6">
      <PageHeader
        eyebrow="Workspace"
        title={t('settings.title', 'Settings')}
        description={t('settings.subtitle', 'Manage your account, security, billing, and integrations.')}
        icon={<SettingsIcon className="w-5 h-5" />}
      />

      {message && (
        <div
          className={`flex items-start gap-vos-3 rounded-vos-lg border px-vos-4 py-vos-3 ${
            message.type === 'success'
              ? 'border-vos-success/30 bg-vos-success/10 text-vos-success'
              : 'border-vos-danger/30 bg-vos-danger/10 text-vos-danger'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="text-vos-sm">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-vos-6">
        {/* Sidebar nav */}
        <aside className="lg:sticky lg:top-vos-6 self-start">
          <div className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-2">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon as IconType;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as TabId)}
                    className={`group flex items-center gap-vos-3 px-vos-3 py-vos-2 rounded-vos-md text-left transition whitespace-nowrap lg:w-full ${
                      isActive
                        ? 'bg-vos-accent/10 text-vos-accent ring-1 ring-vos-accent/30'
                        : 'text-vos-text-2 hover:bg-vos-bg-elev-1 hover:text-vos-text'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-vos-sm flex items-center justify-center transition ${
                        isActive
                          ? 'bg-vos-accent/20 text-vos-accent'
                          : 'bg-vos-bg-elev-1 text-vos-text-3 group-hover:text-vos-text'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-vos-sm font-medium">
                        {t(tab.labelKey, tab.fallback)}
                      </span>
                      <span className="hidden lg:block text-[10px] text-vos-text-3 truncate">
                        {tab.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 overflow-hidden min-w-0">
          {activeMeta && (
            <header className="flex items-center gap-vos-3 px-vos-6 py-vos-4 border-b border-vos-border-1">
              <span className="w-9 h-9 rounded-vos-md bg-vos-accent/10 text-vos-accent flex items-center justify-center">
                {(() => {
                  const Icon = activeMeta.icon as IconType;
                  return <Icon className="w-4 h-4" />;
                })()}
              </span>
              <div className="min-w-0">
                <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">
                  {t(activeMeta.labelKey, activeMeta.fallback)}
                </h2>
                <p className="text-vos-xs text-vos-text-3">{activeMeta.description}</p>
              </div>
              {loading && (
                <span className="ml-auto text-vos-xs text-vos-text-3 inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-vos-accent animate-pulse" />
                  Saving…
                </span>
              )}
            </header>
          )}
          <div className="p-vos-6">{TAB_COMPONENTS[activeTab]}</div>
        </section>
      </div>
    </div>
  );
}
