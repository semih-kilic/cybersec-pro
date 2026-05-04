/**
 * Billing Settings Tab
 * Current plan, upgrade, payment method, billing history
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';
import api from '../../../services/api';
import { useOpenBillingPortal } from '../../../hooks/useApiQueries';

const PLAN_DETAILS: Record<string, { label: string; color: string; gradient: string; price: string }> = {
  trial:         { label: 'Free Trial',    color: 'text-gray-400',   gradient: 'from-gray-600 to-gray-700',     price: '€0' },
  starter:       { label: 'Starter',       color: 'text-blue-400',   gradient: 'from-blue-600 to-blue-700',     price: '€99/mo' },
  professional:  { label: 'Professional',  color: 'text-purple-400', gradient: 'from-purple-600 to-purple-700', price: '€299/mo' },
  enterprise:    { label: 'Enterprise',    color: 'text-yellow-400', gradient: 'from-yellow-600 to-orange-600', price: '€799/mo' },
};

interface BillingData {
  plan_type: string;
  stripe_customer_id: string | null;
  config: {
    level: number;
    price_eur: number;
    tool_limit: number;
    daily_scan_limit: number;
    max_agents: number;
    max_team_members: number;
    max_projects: number;
    multi_tool_scan: number;
    features: Record<string, boolean>;
  };
}

export function BillingTab({ userPlan }: SettingsTabProps) {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const portalMutation = useOpenBillingPortal();

  useEffect(() => {
    (async () => {
      const res = await api.get<BillingData>('/billing/subscription');
      if (res.data) setBilling(res.data);
    })();
  }, []);

  const planKey = billing?.plan_type || userPlan || 'trial';
  const plan = PLAN_DETAILS[planKey] || PLAN_DETAILS.trial;
  const config = billing?.config;

  const toolCount = config?.tool_limit && config.tool_limit > 0 ? `All ${config.tool_limit}` : '—';
  const scanLimit = config?.daily_scan_limit === 0 ? 'Unlimited' : String(config?.daily_scan_limit || 5);
  const agentLimit = config?.max_agents === -1 ? 'Unlimited' : String(config?.max_agents || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-white mb-1">{t('settings.billing.heading', 'Billing & Subscription')}</h2>
        <p className="text-gray-400 text-sm">{t('settings.billing.subtitle', 'Manage your plan, payment method, and billing history')}</p>
      </div>

      {/* Current Plan */}
      <div className={`p-6 bg-gradient-to-r ${plan.gradient} rounded-xl`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider font-medium">{t('billing.currentPlan', 'Current Plan')}</p>
            <h3 className="text-white text-2xl font-bold mt-1">{plan.label}</h3>
            <div className="flex items-center gap-4 mt-3 text-white/80 text-sm flex-wrap">
              <span>🛡️ {toolCount} tools</span>
              <span>🔄 {scanLimit} scans/day</span>
              <span>🤖 {agentLimit} agents</span>
              {config && <span>💰 €{config.price_eur}/month</span>}
            </div>
          </div>
          {planKey !== 'enterprise' && (
            <a href="/dashboard/upgrade" className="px-5 py-2.5 bg-white/20 backdrop-blur text-white font-semibold rounded-lg hover:bg-white/30 transition btn-micro">
              Upgrade Plan
            </a>
          )}
        </div>
      </div>

      {/* Plan Features */}
      {config?.features && (
        <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
          <h3 className="text-white font-semibold mb-4">{t('billing.planFeatures', 'Plan Features')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(config.features).map(([key, enabled]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={enabled ? 'text-green-400' : 'text-gray-600'}>{enabled ? '✓' : '✗'}</span>
                <span className={`text-sm ${enabled ? 'text-gray-300' : 'text-gray-600'}`}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stripe Customer */}
      <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">{t('billing.payment', 'Payment')}</h3>
          {billing?.stripe_customer_id && (
            <span className="text-gray-500 text-xs font-mono">{billing.stripe_customer_id}</span>
          )}
        </div>
        {portalMutation.isError && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {(portalMutation.error as Error)?.message || t('billing.portalError', 'Failed to open billing portal')}
          </div>
        )}
        {billing?.stripe_customer_id ? (
          <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">S</div>
            <div>
              <p className="text-white text-sm font-medium">{t('billing.stripeActive', 'Stripe Payment Active')}</p>
              <p className="text-gray-500 text-xs">{t('billing.stripeManaged', 'Managed through Stripe Checkout')}</p>
            </div>
            <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">{t('common.active', 'Active')}</span>
            <button
              onClick={async () => {
                try {
                  const result = await portalMutation.mutateAsync();
                  window.location.href = result.portal_url;
                } catch {
                  // error handled by mutation state
                }
              }}
              disabled={portalMutation.isPending}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition btn-micro"
            >
              {portalMutation.isPending
                ? t('billing.portalLoading', 'Opening…')
                : t('billing.manageSubscription', 'Manage Subscription')}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 text-center">
            <p className="text-gray-400 text-sm">{t('billing.noPayment', 'No payment method on file')}</p>
            {planKey === 'trial' && (
              <a href="/dashboard/upgrade" className="text-blue-400 hover:underline text-sm mt-1 inline-block">{t('billing.addPayment', 'Add payment method →')}</a>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
