/**
 * 🐉 CyberSec Pro — NotificationCenter
 * Real-time notification bell dropdown with unread badge
 * Supports scan completions, security alerts, team events, and system updates
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export interface Notification {
  id: string;
  type: 'scan_complete' | 'scan_failed' | 'security_alert' | 'team' | 'system' | 'billing';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  severity?: 'info' | 'warning' | 'critical';
  icon?: string;
}

const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  scan_complete: { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  scan_failed: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10' },
  security_alert: { icon: '🛡️', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  team: { icon: '👥', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  system: { icon: '⚙️', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  billing: { icon: '💳', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

function getTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/notifications', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Fallback: generate sample notifications from recent activity
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch { /* ignore */ }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch { /* ignore */ }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all duration-200 active:scale-95"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-red-500/40"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-gray-900/95 backdrop-blur-xl rounded-xl border border-gray-700/60 shadow-2xl shadow-black/40 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <h3 className="font-semibold text-white text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Mark all read
                  </button>
                )}
                <Link
                  to="/dashboard/settings?tab=notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-gray-500 hover:text-white transition"
                >
                  Settings
                </Link>
              </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto max-h-[380px] scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
              {loading && notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400 font-medium">All caught up!</p>
                  <p className="text-xs text-gray-600 mt-1">No new notifications</p>
                </div>
              ) : (
                notifications.map((notif, idx) => {
                  const config = typeConfig[notif.type] || typeConfig.system;
                  const content = (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`flex gap-3 px-4 py-3 border-b border-gray-800/30 hover:bg-gray-800/40 transition cursor-pointer ${
                        !notif.read ? 'bg-cyan-500/5' : ''
                      }`}
                      onClick={() => markRead(notif.id)}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center text-sm`}>
                        {notif.icon || config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${notif.read ? 'text-gray-300' : 'text-white'}`}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-cyan-400 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-xs text-gray-600 mt-1">{getTimeAgo(notif.timestamp)}</p>
                      </div>
                    </motion.div>
                  );

                  return notif.link ? (
                    <Link key={notif.id} to={notif.link} onClick={() => setIsOpen(false)}>
                      {content}
                    </Link>
                  ) : content;
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-800/60 text-center">
                <Link
                  to="/dashboard/settings?tab=notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition font-medium"
                >
                  View all notifications →
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationCenter;
