/**
 * Team Management Settings Tab
 * Members, invitations, role management
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { SettingsTabProps } from './types';
import api from '../../../services/api';

interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export function TeamTab({ user, userPlan, setMessage }: SettingsTabProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    const res = await api.getTeamMembers();
    if (res.data) {
      setMembers(res.data.members);
      setInvitations(res.data.invitations);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await api.inviteTeamMember(inviteEmail.trim(), inviteRole);
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({ type: 'success', text: `${t('settings.team.invitationSent', 'Invitation sent to')} ${inviteEmail}` });
        setInviteEmail('');
        setShowInvite(false);
        loadTeam();
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    const res = await api.removeTeamMember(memberId);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: res.data?.message || t('settings.team.memberRemoved', 'Member removed') });
      loadTeam();
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      superadmin: 'bg-red-500/20 text-red-400',
      admin: 'bg-purple-500/20 text-purple-400',
      analyst: 'bg-cyan-500/20 text-cyan-400',
      user: 'bg-blue-500/20 text-blue-400',
      viewer: 'bg-gray-500/20 text-gray-400',
    };
    return colors[role] || colors.user;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{t('settings.team.heading', 'Team Management')}</h2>
          <p className="text-gray-400 text-sm">{t('settings.team.subtitle', 'Invite team members and manage roles')}</p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 btn-micro"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('settings.team.inviteMember', 'Invite Member')}
        </button>
      </div>

      {/* Invite Form */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-800/80 rounded-xl border border-gray-700 p-5 space-y-4"
          >
            <h3 className="text-white font-medium">Invite Team Member</h3>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="team@example.com"
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-kali-blue transition"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
              >
                <option value="viewer">Viewer</option>
                <option value="user">User</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-5 py-2 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-medium">Team Members ({members.length})</h3>
        </div>
        <div className="divide-y divide-gray-700/50">
          {members.map(member => (
            <div key={member.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                  {member.first_name?.[0] || member.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{member.first_name || ''} {member.last_name || ''}</p>
                  <p className="text-gray-500 text-sm">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadge(member.role)}`}>
                  {member.role === 'superadmin' ? 'Owner' : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>
                {member.id !== user?.id && member.role !== 'superadmin' && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-white font-medium">Pending Invitations</h3>
          </div>
          <div className="divide-y divide-gray-700/50">
            {invitations.map(inv => (
              <div key={inv.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-white">{inv.email}</p>
                  <p className="text-gray-500 text-xs">Invited {new Date(inv.created_at).toLocaleDateString()} · Role: {inv.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">Pending</span>
                  <button
                    onClick={() => handleRemove(inv.id)}
                    className="text-gray-400 hover:text-red-400 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
