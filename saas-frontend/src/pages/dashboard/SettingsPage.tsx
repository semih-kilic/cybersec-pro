import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useSearchParams } from 'react-router-dom';
import { PageTransition } from '../../components/ui';
import {
  ProfileTab,
  SecurityTab,
  NotificationsTab,
  ApiKeysTab,
  TeamTab,
  IntegrationsTab,
  SSOTab,
  BillingTab,
} from './settings';
import type { SettingsMessage } from './settings';

const TABS = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'security', label: 'Security', icon: '🔐' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'api', label: 'API Keys', icon: '🔑' },
  { id: 'integrations', label: 'Integrations', icon: '🔗' },
  { id: 'sso', label: 'SSO', icon: '🏢' },
  { id: 'billing', label: 'Billing', icon: '💳' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function SettingsPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('settings.title', 'Settings')} — CyberSec Pro`);
  const { user, organization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const userPlan = organization?.plan_type || 'trial';

  const tabParam = searchParams.get('tab');
  const validIds = TABS.map(t => t.id) as readonly string[];
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
  };

  return (
    <PageTransition>
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('settings.title', 'Settings')}</h1>
        <p className="text-gray-400">{t('settings.subtitle', 'Manage your account settings and preferences')}</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 border border-green-500 text-green-400' : 'bg-red-500/20 border border-red-500 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
        {/* Tabs — V17: horizontal scrollable on mobile, sidebar on desktop */}
        <div className="w-full lg:w-48 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 lg:space-y-1 scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg text-left transition whitespace-nowrap flex-shrink-0 lg:w-full ${
                  activeTab === tab.id
                    ? 'bg-kali-blue/20 text-kali-blue border-b-2 lg:border-b-0 lg:border-l-2 border-kali-blue'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium text-sm">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800 min-w-0">
          {TAB_COMPONENTS[activeTab]}
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

