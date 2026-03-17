/**
 * Notifications Settings Tab
 * Email, browser, in-app notification preferences
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';
import api from '../../../services/api';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-kali-blue' : 'bg-gray-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export function NotificationsTab({ setMessage }: SettingsTabProps) {
  const [prefs, setPrefs] = useState({
    email_scan_complete: true,
    email_weekly_report: true,
    email_security_alerts: true,
    browser_notifications: true,
    quiet_hours: { enabled: false, from: '22:00', to: '08:00' },
  });

  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getNotificationPreferences().then(res => {
      if (res.data) {
        setPrefs(res.data);
      }
      setLoaded(true);
    });
  }, []);

  const notificationOptions = [
    {
      key: 'email_scan_complete' as const,
      title: 'Email on Scan Complete',
      desc: 'Get notified when a scan finishes',
      icon: '📧',
    },
    {
      key: 'email_weekly_report' as const,
      title: 'Weekly Security Report',
      desc: 'Receive a weekly summary of your security findings',
      icon: '📊',
    },
    {
      key: 'email_security_alerts' as const,
      title: 'Security Alerts',
      desc: 'Get notified about critical security events',
      icon: '🚨',
    },
    {
      key: 'browser_notifications' as const,
      title: 'Browser Notifications',
      desc: 'Show desktop notifications for important events',
      icon: '🔔',
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.updateNotificationPreferences(prefs);
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({ type: 'success', text: 'Notification preferences saved!' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className="text-gray-400 py-8 text-center">Loading preferences...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <h2 className="text-xl font-bold text-white mb-4">Notification Preferences</h2>

      <div className="space-y-3">
        {notificationOptions.map((opt) => (
          <div key={opt.key} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-800/80 transition">
            <div className="flex items-center gap-3">
              <span className="text-xl">{opt.icon}</span>
              <div>
                <p className="text-white font-medium">{opt.title}</p>
                <p className="text-gray-400 text-sm">{opt.desc}</p>
              </div>
            </div>
            <Toggle
              checked={prefs[opt.key as keyof typeof prefs] as boolean}
              onChange={(v) => setPrefs({ ...prefs, [opt.key]: v })}
              label={opt.title}
            />
          </div>
        ))}
      </div>

      {/* Quiet Hours */}
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-semibold text-white mb-3">Quiet Hours</h3>
        <p className="text-gray-400 text-sm mb-4">Pause non-critical notifications during specific hours</p>
        <div className="flex items-center gap-4 mb-3">
          <Toggle
            checked={prefs.quiet_hours.enabled}
            onChange={(v) => setPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, enabled: v } })}
            label="Enable quiet hours"
          />
          <span className="text-gray-400 text-sm">{prefs.quiet_hours.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        {prefs.quiet_hours.enabled && (
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-gray-500 text-xs mb-1">From</label>
              <select
                value={prefs.quiet_hours.from}
                onChange={(e) => setPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, from: e.target.value } })}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <span className="text-gray-500 mt-4">→</span>
            <div>
              <label className="block text-gray-500 text-xs mb-1">To</label>
              <select
                value={prefs.quiet_hours.to}
                onChange={(e) => setPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, to: e.target.value } })}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50 btn-micro"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </motion.div>
  );
}
