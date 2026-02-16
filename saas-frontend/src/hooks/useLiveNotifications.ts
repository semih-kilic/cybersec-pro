/**
 * useLiveNotifications
 *
 * Connects WebSocket events → in-app toast notifications.
 * Also maintains a notification badge counter for the Header bell icon.
 */
import { useEffect, useState, useCallback } from 'react';
import { wsManager } from '../lib/socketManager';
import { useToast } from '../components/ui/Toast';

export interface LiveNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export function useLiveNotifications() {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const toast = useToast();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback(
    (type: LiveNotification['type'], title: string, message: string) => {
      const notif: LiveNotification = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 50)); // Keep last 50

      // Also show toast
      toast[type](title, message);
    },
    [toast]
  );

  useEffect(() => {
    const unsubs = [
      // Scan completed
      wsManager.on('scan_complete', (data: unknown) => {
        const d = data as { scan_id: string; status: string; exit_code: number };
        if (d.status === 'completed' && d.exit_code === 0) {
          addNotification(
            'success',
            'Scan Completed',
            `Scan ${d.scan_id.slice(0, 8)}... finished successfully.`
          );
        } else {
          addNotification(
            'error',
            'Scan Failed',
            `Scan ${d.scan_id.slice(0, 8)}... failed (exit ${d.exit_code}).`
          );
        }
      }),

      // Agent status
      wsManager.on('agent_status', (data: unknown) => {
        const d = data as {
          agent_id?: string;
          agent_name?: string;
          status: string;
          previous_status?: string;
        };
        if (d.status === 'offline') {
          addNotification(
            'warning',
            'Agent Disconnected',
            `${d.agent_name || 'Agent'} went offline.`
          );
        } else if (d.status === 'online' && d.previous_status === 'offline') {
          addNotification(
            'info',
            'Agent Online',
            `${d.agent_name || 'Agent'} is back online.`
          );
        }
      }),

      // Generic server notification (new tool, maintenance, etc.)
      wsManager.on('notification', (data: unknown) => {
        const d = data as { title: string; body?: string; type?: string };
        const type = (['success', 'warning', 'error', 'info'].includes(d.type || '')
          ? d.type
          : 'info') as LiveNotification['type'];
        addNotification(type, d.title, d.body || '');
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [addNotification]);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    addNotification,
  };
}

export default useLiveNotifications;
