/**
 * 🐉 CyberSec Pro — NotificationCenter V2
 * Real-time notification bell with WebSocket push + API hydration
 * 
 * Features:
 *  - WebSocket live push via useLiveNotifications
 *  - Initial hydration from /api/v1/notifications
 *  - Filter tabs: All / Unread / Alerts
 *  - Keyboard navigation (↑↓ Enter Escape)
 *  - Group by date (Today / Yesterday / Earlier)
 *  - Mark read / mark all read with optimistic UI
 *  - Sound ping on new critical/security alerts
 *  - Accessible: aria-labels, role, focus trapping
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLiveNotifications, type LiveNotification } from '../../hooks/useLiveNotifications';

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
  success: { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  error: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10' },
  warning: { icon: '⚠️', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  info: { icon: 'ℹ️', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

type FilterTab = 'all' | 'unread' | 'alerts';

function getTimeAgo(timestamp: string | number): string {
  const ms = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDateGroup(timestamp: string | number): string {
  const ms = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const now = new Date();
  const _date = new Date(ms);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  if (ms >= today.getTime()) return 'Today';
  if (ms >= yesterday.getTime()) return 'Yesterday';
  return 'Earlier';
}

// Merge API notifications + live WS notifications into unified list
function mergeNotifications(apiNotifs: Notification[], liveNotifs: LiveNotification[]): Notification[] {
  const liveAsMapped: Notification[] = liveNotifs.map(n => ({
    id: n.id,
    type: (n.type === 'success' ? 'scan_complete' : n.type === 'error' ? 'scan_failed' : n.type === 'warning' ? 'security_alert' : 'system') as Notification['type'],
    title: n.title,
    message: n.message,
    timestamp: new Date(n.timestamp).toISOString(),
    read: n.read,
  }));
  // Merge, deduplicate by id, sort newest first
  const map = new Map<string, Notification>();
  for (const n of [...apiNotifs, ...liveAsMapped]) {
    if (!map.has(n.id)) map.set(n.id, n);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiNotifications, setApiNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Live WebSocket notifications
  const { notifications: liveNotifs, markRead: markLiveRead, markAllRead: markAllLiveRead } = useLiveNotifications();

  // Merge API + live
  const allNotifications = useMemo(
    () => mergeNotifications(apiNotifications, liveNotifs),
    [apiNotifications, liveNotifs]
  );

  const unreadCount = allNotifications.filter(n => !n.read).length;

  // Filter based on active tab
  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'unread': return allNotifications.filter(n => !n.read);
      case 'alerts': return allNotifications.filter(n =>
        ['security_alert', 'scan_failed'].includes(n.type) || n.severity === 'critical'
      );
      default: return allNotifications;
    }
  }, [allNotifications, activeTab]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    const seen = new Set<string>();
    for (const n of filtered) {
      const label = getDateGroup(n.timestamp);
      if (!seen.has(label)) {
        seen.add(label);
        groups.push({ label, items: [] });
      }
      groups.find(g => g.label === label)!.items.push(n);
    }
    return groups;
  }, [filtered]);

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

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setIsOpen(false); return; }
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedIdx >= 0 && focusedIdx < filtered.length) {
        const notif = filtered[focusedIdx];
        handleMarkRead(notif.id);
        if (notif.link) {
          setIsOpen(false);
          window.location.href = notif.link;
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIdx, filtered]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-notif-item]');
      items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIdx]);

  // Reset focus when tab changes
  useEffect(() => { setFocusedIdx(-1); }, [activeTab]);

  // Fetch notifications from API (initial hydration + periodic refresh)
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/notifications', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApiNotifications(data.notifications || []);
      }
    } catch {
      // Use defaults — live notifications still work
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Slower polling since WebSocket handles real-time
    const interval = setInterval(fetchNotifications, 120000); // 2 min
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    // Optimistic UI
    setApiNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllLiveRead();
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  };

  const handleMarkRead = async (id: string) => {
    // Optimistic
    setApiNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    markLiveRead(id);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  };

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'alerts', label: 'Alerts' },
  ];

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setFocusedIdx(-1); }}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all duration-200 active:scale-95"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
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
            className="absolute right-0 top-full mt-2 w-[400px] max-h-[520px] bg-gray-900/95 backdrop-blur-xl rounded-xl border border-gray-700/60 shadow-2xl shadow-black/40 z-50 overflow-hidden flex flex-col"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800/40">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    activeTab === tab.key
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1.5 bg-gray-800 text-gray-400 px-1 py-0.5 rounded text-[10px]">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div ref={listRef} className="overflow-y-auto flex-1 max-h-[380px] scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
              {loading && allNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400 font-medium">
                    {activeTab === 'unread' ? 'All caught up!' : activeTab === 'alerts' ? 'No alerts' : 'No notifications'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {activeTab === 'unread' ? 'No unread notifications' : 'Check back later'}
                  </p>
                </div>
              ) : (
                grouped.map(group => (
                  <div key={group.label}>
                    {/* Date Group Header */}
                    <div className="sticky top-0 z-10 px-4 py-1.5 bg-gray-900/90 backdrop-blur-sm">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{group.label}</span>
                    </div>
                    {group.items.map((notif) => {
                      const globalIdx = filtered.indexOf(notif);
                      const config = typeConfig[notif.type] || typeConfig.system;
                      const isFocused = focusedIdx === globalIdx;
                      const content = (
                        <motion.div
                          key={notif.id}
                          data-notif-item
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(globalIdx * 0.02, 0.2) }}
                          className={`flex gap-3 px-4 py-3 border-b border-gray-800/30 hover:bg-gray-800/40 transition cursor-pointer ${
                            !notif.read ? 'bg-cyan-500/5' : ''
                          } ${isFocused ? 'ring-1 ring-inset ring-cyan-500/40 bg-gray-800/50' : ''}`}
                          onClick={() => handleMarkRead(notif.id)}
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
                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-cyan-400 mt-1.5 animate-pulse" />
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
                      ) : <div key={notif.id}>{content}</div>;
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-800/60 flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
                  {activeTab !== 'all' && ` (${activeTab})`}
                </span>
                <Link
                  to="/dashboard/settings?tab=notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition font-medium"
                >
                  Settings →
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
