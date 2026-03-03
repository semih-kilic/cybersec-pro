/**
 * Integrations Settings Tab
 * Third-party tool connections (Slack, Jira, GitHub, etc.)
 */
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';

const integrations = [
  { name: 'Slack', desc: 'Get real-time vulnerability alerts in your Slack channels', icon: '💬', status: 'available' as const, plan: 'professional' },
  { name: 'Microsoft Teams', desc: 'Receive scan notifications in Microsoft Teams', icon: '💼', status: 'available' as const, plan: 'professional' },
  { name: 'Jira', desc: 'Auto-create tickets for discovered vulnerabilities', icon: '🎫', status: 'coming_soon' as const, plan: 'professional' },
  { name: 'GitHub', desc: 'Trigger scans on deployment, add security checks to PRs', icon: '🐙', status: 'available' as const, plan: 'professional' },
  { name: 'GitLab CI', desc: 'Integrate security scanning into your CI/CD pipeline', icon: '🦊', status: 'coming_soon' as const, plan: 'professional' },
  { name: 'PagerDuty', desc: 'Escalate critical vulnerabilities to your on-call team', icon: '🚨', status: 'coming_soon' as const, plan: 'enterprise' },
  { name: 'Splunk', desc: 'Export vulnerability data to your SIEM', icon: '📊', status: 'coming_soon' as const, plan: 'enterprise' },
  { name: 'Webhooks', desc: 'Send scan events to any URL endpoint', icon: '🔗', status: 'available' as const, plan: 'starter' },
];

export function IntegrationsTab(_props: SettingsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Integrations</h2>
        <p className="text-gray-400 text-sm">Connect CyberSec Pro with your existing tools</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration, i) => (
          <motion.div
            key={integration.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 flex items-start gap-4 hover:border-gray-600 transition"
          >
            <span className="text-2xl">{integration.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium">{integration.name}</h3>
                {integration.status === 'coming_soon' && (
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">Coming Soon</span>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-1">{integration.desc}</p>
              <div className="mt-3">
                {integration.status === 'available' ? (
                  <button className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-600/30 transition btn-micro">
                    Configure
                  </button>
                ) : (
                  <span className="text-gray-600 text-xs">Requires {integration.plan} plan</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
