/**
 * Team Management Settings Tab
 * Members, invitations, role management
 */
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';

export function TeamTab({ user, userPlan }: SettingsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Team Management</h2>
          <p className="text-gray-400 text-sm">Invite team members and manage roles</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 btn-micro">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Invite Member
        </button>
      </div>

      {/* Members */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-medium">Team Members</h3>
        </div>
        <div className="divide-y divide-gray-700/50">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-white font-medium">{user?.first_name} {user?.last_name || ''}</p>
                <p className="text-gray-500 text-sm">{user?.email}</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">Owner</span>
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
        <h3 className="text-white font-medium mb-4">Available Roles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { role: 'Admin', desc: 'Full access to all settings, billing, and team management', icon: '👑', color: 'from-yellow-500/20 to-orange-500/20' },
            { role: 'Analyst', desc: 'Can run scans, view reports, and manage targets', icon: '🔍', color: 'from-blue-500/20 to-cyan-500/20' },
            { role: 'Viewer', desc: 'Read-only access to dashboards and reports', icon: '👁️', color: 'from-gray-500/20 to-gray-600/20' },
          ].map(r => (
            <div key={r.role} className={`p-4 bg-gradient-to-br ${r.color} rounded-lg border border-gray-700/50`}>
              <div className="flex items-center gap-2 mb-2">
                <span>{r.icon}</span>
                <span className="text-white font-medium text-sm">{r.role}</span>
              </div>
              <p className="text-gray-500 text-xs">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {(userPlan === 'trial' || userPlan === 'starter') && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 text-center">
          <p className="text-yellow-400 font-medium mb-2">Team management requires Professional plan or higher</p>
          <a href="/dashboard/billing/upgrade" className="text-blue-400 hover:underline text-sm">Upgrade to invite team members →</a>
        </div>
      )}
    </motion.div>
  );
}
