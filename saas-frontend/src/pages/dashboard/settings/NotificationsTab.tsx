/**
 * Notifications Settings Tab
 * Email, browser, in-app notification preferences
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { SettingsTabProps, UserSettings } from './types';

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
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email_scan_complete: true,
      email_weekly_report: true,
      browser_notifications: true,
    },
    theme: 'dark',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: 'en',
  });

  const [saving, setSaving] = useState(false);

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
      key: 'browser_notifications' as const,
      title: 'Browser Notifications',
      desc: 'Show desktop notifications for important events',
      icon: '🔔',
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessage({ type: 'success', text: 'Notification preferences saved!' });
    } finally {
      setSaving(false);
    }
  };

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
              checked={settings.notifications[opt.key]}
              onChange={(v) => setSettings({
                ...settings,
                notifications: { ...settings.notifications, [opt.key]: v }
              })}
              label={opt.title}
            />
          </div>
        ))}
      </div>

      {/* Quiet Hours */}
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-semibold text-white mb-3">Quiet Hours</h3>
        <p className="text-gray-400 text-sm mb-4">Pause non-critical notifications during specific hours</p>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-gray-500 text-xs mb-1">From</label>
            <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option>10:00 PM</option>
              <option>11:00 PM</option>
              <option>12:00 AM</option>
            </select>
          </div>
          <span className="text-gray-500 mt-4">→</span>
          <div>
            <label className="block text-gray-500 text-xs mb-1">To</label>
            <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option>7:00 AM</option>
              <option>8:00 AM</option>
              <option>9:00 AM</option>
            </select>
          </div>
        </div>
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
