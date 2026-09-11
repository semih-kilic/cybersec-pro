/**
 * useBrowserNotifications
 *
 * Thin wrapper over the native Notification API.
 *
 * It used to bridge Socket.IO events (`scan_complete`, `agent_status`,
 * `notification`) to native notifications, but no WebSocket server exists —
 * the backend streams scan output over SSE — so none of those events ever
 * fired and `show()` was unreachable. Worse, the dashboard asked every user
 * for notification permission on mount for a feature that could never fire.
 *
 * Now the caller drives it: request permission from a real user gesture
 * (starting a scan), then call `show()` when something actually finishes.
 */
import { useCallback, useState } from 'react';

type PermissionState = 'default' | 'granted' | 'denied';

const currentPermission = (): PermissionState =>
  typeof Notification !== 'undefined' ? (Notification.permission as PermissionState) : 'denied';

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<PermissionState>(currentPermission);

  /**
   * Ask once, from a user gesture. Safe to call repeatedly: the browser only
   * prompts while the state is still `default`. Resolves to the outcome so a
   * caller can act on it without waiting for a re-render.
   */
  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission !== 'default') {
      const existing = currentPermission();
      setPermission(existing);
      return existing;
    }
    try {
      const result = (await Notification.requestPermission()) as PermissionState;
      setPermission(result);
      return result;
    } catch {
      // Safari <16 only supports the callback form.
      return new Promise<PermissionState>((resolve) => {
        Notification.requestPermission((res) => {
          setPermission(res as PermissionState);
          resolve(res as PermissionState);
        });
      });
    }
  }, []);

  /**
   * Show a native notification. No-op unless permission was granted and the
   * tab is in the background — a notification for the page you are looking at
   * is just noise.
   *
   * Reads `Notification.permission` directly rather than the state above so a
   * grant that happened moments ago is honoured without waiting for a render.
   */
  const show = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.hasFocus()) return;

    try {
      const n = new Notification(title, {
        icon: '/dashboard/favicon.ico',
        badge: '/dashboard/favicon.ico',
        ...options,
      });
      setTimeout(() => n.close(), 8000);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn('[Notification] Failed:', e);
    }
  }, []);

  return { permission, requestPermission, show };
}

export default useBrowserNotifications;
