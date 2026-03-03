/**
 * Billing Settings Tab
 * Current plan, upgrade, payment method, billing history
 */
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';

const PLAN_DETAILS: Record<string, { label: string; color: string; gradient: string }> = {
  trial:      { label: 'Free Trial',  color: 'text-gray-400',   gradient: 'from-gray-600 to-gray-700' },
  starter:    { label: 'Starter',     color: 'text-blue-400',   gradient: 'from-blue-600 to-blue-700' },
  professional: { label: 'Professional', color: 'text-purple-400', gradient: 'from-purple-600 to-purple-700' },
  enterprise: { label: 'Enterprise',  color: 'text-yellow-400', gradient: 'from-yellow-600 to-orange-600' },
};

export function BillingTab({ userPlan }: SettingsTabProps) {
  const plan = PLAN_DETAILS[userPlan || 'trial'] || PLAN_DETAILS.trial;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Billing & Subscription</h2>
        <p className="text-gray-400 text-sm">Manage your plan, payment method, and billing history</p>
      </div>

      {/* Current Plan */}
      <div className={`p-6 bg-gradient-to-r ${plan.gradient} rounded-xl`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider font-medium">Current Plan</p>
            <h3 className="text-white text-2xl font-bold mt-1">{plan.label}</h3>
            <div className="flex items-center gap-4 mt-3 text-white/80 text-sm">
              <span>🛡️ {userPlan === 'enterprise' ? 'Unlimited' : userPlan === 'professional' ? '165' : '25'} tools</span>
              <span>🔄 {userPlan === 'enterprise' ? 'Unlimited' : userPlan === 'professional' ? '100' : '5'} scans/day</span>
              <span>📅 Next billing: Feb 15, 2025</span>
            </div>
          </div>
          {userPlan !== 'enterprise' && (
            <a href="/dashboard/upgrade" className="px-5 py-2.5 bg-white/20 backdrop-blur text-white font-semibold rounded-lg hover:bg-white/30 transition btn-micro">
              Upgrade Plan
            </a>
          )}
        </div>
      </div>

      {/* Payment Method */}
      <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Payment Method</h3>
          <button className="text-kali-blue text-sm hover:underline btn-micro">Update</button>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
            VISA
          </div>
          <div>
            <p className="text-white text-sm font-medium">•••• •••• •••• 4242</p>
            <p className="text-gray-500 text-xs">Expires 12/2026</p>
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <h3 className="text-white font-semibold mb-4">Billing History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">Date</th>
                <th className="text-left py-2 pr-4 font-medium">Description</th>
                <th className="text-left py-2 pr-4 font-medium">Amount</th>
                <th className="text-left py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                { date: 'Jan 15, 2025', desc: 'Professional Plan - Monthly', amount: '$49.00', status: 'Paid' },
                { date: 'Dec 15, 2024', desc: 'Professional Plan - Monthly', amount: '$49.00', status: 'Paid' },
                { date: 'Nov 15, 2024', desc: 'Professional Plan - Monthly', amount: '$49.00', status: 'Paid' },
              ].map((inv, i) => (
                <tr key={i} className="border-b border-gray-700/50">
                  <td className="py-3 pr-4">{inv.date}</td>
                  <td className="py-3 pr-4">{inv.desc}</td>
                  <td className="py-3 pr-4 font-mono">{inv.amount}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
