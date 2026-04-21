/**
 * Integrations Settings Tab
 * Third-party tool connections (Slack, Jira, GitHub, Webhooks)
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useIntegrations, useCreateIntegration, useDeleteIntegration, useToggleIntegration, useTestIntegration } from '../../../hooks/useApiQueries';
import type { SettingsTabProps } from './types';

const INTEGRATION_TYPES = [
  { type: 'slack', name: 'Slack', desc: 'Get real-time vulnerability alerts in your Slack channels', icon: '💬', plan: 'professional' },
  { type: 'teams', name: 'Microsoft Teams', desc: 'Receive scan notifications in Microsoft Teams', icon: '💼', plan: 'professional' },
  { type: 'jira', name: 'Jira', desc: 'Auto-create tickets for discovered vulnerabilities', icon: '🎫', plan: 'professional' },
  { type: 'github', name: 'GitHub', desc: 'Trigger scans on deployment, add security checks to PRs', icon: '🐙', plan: 'professional' },
  { type: 'webhook', name: 'Webhooks', desc: 'Send scan events to any HTTPS endpoint', icon: '🔗', plan: 'starter' },
];

export function IntegrationsTab(_props: SettingsTabProps) {
  const { t } = useTranslation();
  const { data: integrations = [], isLoading } = useIntegrations();
  const createIntegration = useCreateIntegration();
  const deleteIntegration = useDeleteIntegration();
  const toggleIntegration = useToggleIntegration();
  const testIntegration = useTestIntegration();

  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('slack');
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [testResult, setTestResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    await createIntegration.mutateAsync({ name: newName, integration_type: newType, webhook_url: newUrl });
    setShowAdd(false);
    setNewName('');
    setNewUrl('');
  };

  const handleTest = async (id: string) => {
    try {
      const res = await testIntegration.mutateAsync(id);
      setTestResult({ id, msg: res.success ? (res.message || t('settings.integrations.success', 'Success!')) : (res.error || t('common.failed', 'Failed')), ok: res.success });
    } catch {
      setTestResult({ id, msg: t('settings.integrations.testFailed', 'Test failed'), ok: false });
    }
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{t('settings.integrations.heading', 'Integrations')}</h2>
          <p className="text-gray-400 text-sm">{t('settings.integrations.subtitle', 'Connect CyberSec Pro with your existing tools')}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + {t('settings.integrations.add', 'Add Integration')}
        </button>
      </div>

      {/* Active integrations */}
      {isLoading ? (
        <div className="text-gray-500 text-center py-8">{t('integrations.loading', 'Loading integrations...')}</div>
      ) : integrations.length > 0 ? (
        <div className="space-y-3">
          {integrations.map((int) => {
            const def = INTEGRATION_TYPES.find(t => t.type === int.integration_type);
            return (
              <motion.div key={int.id} layout className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 flex items-center gap-4">
                <span className="text-2xl">{def?.icon || '🔗'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium">{int.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${int.is_active ? 'bg-green-700/30 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {int.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{int.webhook_url || 'No URL'}</p>
                  {int.last_error && <p className="text-red-400 text-xs mt-0.5">Last error: {int.last_error}</p>}
                  {int.last_triggered_at && <p className="text-gray-600 text-xs">Last triggered: {new Date(int.last_triggered_at).toLocaleString()}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {testResult?.id === int.id && (
                    <span className={`text-xs px-2 py-1 rounded ${testResult.ok ? 'bg-green-700/30 text-green-400' : 'bg-red-700/30 text-red-400'}`}>
                      {testResult.msg}
                    </span>
                  )}
                  <button onClick={() => handleTest(int.id)} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition">
                    Test
                  </button>
                  <button onClick={() => toggleIntegration.mutate(int.id)} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition">
                    {int.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => { if (confirm('Delete this integration?')) deleteIntegration.mutate(int.id); }} className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs hover:bg-red-600/30 transition">
                    Delete
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <span className="text-4xl block mb-3">🔗</span>
          <p>{t('integrations.noIntegrations', 'No integrations configured yet.')}</p>
          <p className="text-xs mt-1">{t('integrations.addHint', 'Add Slack, Teams, Webhooks or more to get real-time notifications.')}</p>
        </div>
      )}

      {/* Available types (not yet configured) */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">{t('integrations.available', 'Available Integrations')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INTEGRATION_TYPES.map((t, i) => {
            const configured = integrations.some(int => int.integration_type === t.type);
            return (
              <motion.div key={t.type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4 flex items-start gap-3">
                <span className="text-xl">{t.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-white text-sm font-medium">{t.name}</h4>
                    {configured && <span className="px-1.5 py-0.5 bg-green-700/20 text-green-500 rounded text-[10px]">Configured</span>}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{t.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Add Integration Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-white">{t('integrations.addIntegration', 'Add Integration')}</h3>
              <div>
                <label className="text-sm text-gray-400 block mb-1">{t('common.type', 'Type')}</label>
                <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  {INTEGRATION_TYPES.map(t => <option key={t.type} value={t.type}>{t.icon} {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">{t('common.name', 'Name')}</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('integrations.namePlaceholder', 'e.g. Security Alerts Channel')} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">{t('integrations.webhookUrl', 'Webhook URL')}</label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder={t('integrations.webhookPlaceholder', 'https://hooks.slack.com/services/...')} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                <p className="text-gray-600 text-xs mt-1">{t('integrations.httpsHint', 'Must start with https://')}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition">
                  Cancel
                </button>
                <button onClick={handleAdd} disabled={createIntegration.isPending || !newName.trim() || !newUrl.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {createIntegration.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
