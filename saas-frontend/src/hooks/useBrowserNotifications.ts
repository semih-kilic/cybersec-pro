/**
 * useBrowserNotifications
 *
 * Bridges WebSocket events to the native Notification API.
 *  - Requests permission once
 *  - Listens for scan_complete, agent_status, notification events
 *  - Shows browser notifications even when tab is not focused
 */
import { useEffect, useCallback, useState } from 'react';
import { wsManager } from '../lib/socketManager';

type PermissionState = 'default' | 'granted' | 'denied';

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<PermissionState>(
    typeof Notification !== 'undefined' ? Notification.permission as PermissionState : 'denied'
  );

  // Request permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
    } catch {
      // Safari fallback
      Notification.requestPermission((res) => setPermission(res as PermissionState));
    }
  }, []);

  // Show native notification
  const show = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission !== 'granted') return;
      if (document.hasFocus()) return; // Don't show if tab is active

      try {
        const n = new Notification(title, {
          icon: '/dashboard/favicon.ico',
          badge: '/dashboard/favicon.ico',
          ...options,
        });
        // Auto-close after 8s
        setTimeout(() => n.close(), 8000);
        // Focus tab on click
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch (e) {
        console.warn('[Notification] Failed:', e);
      }
    },
    [permission]
  );

  // Wire up WebSocket events → browser notifications
  useEffect(() => {
    if (permission !== 'granted') return;

    const unsubs = [
      // Scan completed
      wsManager.on('scan_complete', (data: unknown) => {
        const d = data as { scan_id: string; status: string; exit_code: number };
        const isSuccess = d.status === 'completed' && d.exit_code === 0;
        show(
          isSuccess ? 'Scan Completed' : 'Scan Failed',
          {
            body: isSuccess
              ? `Scan ${d.scan_id.slice(0, 8)} finished successfully.`
              : `Scan ${d.scan_id.slice(0, 8)} failed (exit code ${d.exit_code}).`,
            tag: `scan-${d.scan_id}`,
          }
        );
      }),

      // Agent status change
      wsManager.on('agent_status', (data: unknown) => {
        const d = data as { agent_name?: string; status: string };
        if (d.status === 'offline') {
          show('Agent Offline', {
            body: `${d.agent_name || 'An agent'} went offline.`,
            tag: 'agent-offline',
          });
        }
      }),

      // Generic notification from server
      wsManager.on('notification', (data: unknown) => {
        const d = data as { title: string; body?: string; type?: string };
        show(d.title, { body: d.body, tag: 'server-notification' });
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [permission, show]);

  return { permission, requestPermission };
}

export default useBrowserNotifications;
