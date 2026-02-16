/**
 * ActivityFeed – Real-time collaborative activity feed.
 *
 * Shows who is doing what: "Admin started nmap on 8.8.8.8"
 * Combines REST endpoint data + live WebSocket activity events.
 */
import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { wsManager } from '../../lib/socketManager';
import { useAuth } from '../../hooks/useAuth';

// ---- Types ----
interface ActivityEntry {
  id: string;
  user_name: string;
  action: string;
  details: string;
  resource_type: string;
  resource_id: string;
  timestamp: number;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() / 1000) - ts);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const actionIcons: Record<string, string> = {
  'started scan': '🔍',
  'completed scan': '✅',
  'scan completed': '✅',
  'scan failed': '❌',
  'scan cancelled': '🚫',
  'added agent': '🖥️',
  'connected agent': '🔌',
  'default': '📋',
};

function getActionIcon(action: string): string {
  return actionIcons[action] || actionIcons['default'];
}

const actionColors: Record<string, string> = {
  'started scan': 'text-blue-400',
  'completed scan': 'text-green-400',
  'scan completed': 'text-green-400',
  'scan failed': 'text-red-400',
  'scan cancelled': 'text-yellow-400',
  'default': 'text-gray-400',
};

function getActionColor(action: string): string {
  return actionColors[action] || actionColors['default'];
}

// ---- Single Entry ----
const ActivityItem = memo(function ActivityItem({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors">
      <div className="text-lg flex-shrink-0 mt-0.5">{getActionIcon(entry.action)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium text-white">{entry.user_name}</span>{' '}
          <span className={getActionColor(entry.action)}>{entry.action}</span>
        </p>
        {entry.details && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.details}</p>
        )}
      </div>
      <span className="text-xs text-gray-600 flex-shrink-0 whitespace-nowrap">
        {timeAgo(entry.timestamp)}
      </span>
    </div>
  );
});

// ---- Live Indicator ----
function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        connected ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
      }`}
      title={connected ? 'Live' : 'Offline'}
    />
  );
}

// ---- Main Component ----
export function ActivityFeed({ maxItems = 25 }: { maxItems?: number }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(wsManager.isConnected);
  const { token, organization } = useAuth();
  const { t } = useTranslation();

  // Fetch initial data from REST API
  useEffect(() => {
    if (!token) return;

    const apiBase = (import.meta as any).env?.VITE_API_URL || '';
    fetch(`${apiBase}/api/v1/activity`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.entries) {
          setEntries(data.entries.slice(0, maxItems));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, maxItems]);

  // Subscribe to live WebSocket activity events
  useEffect(() => {
    const orgId = organization?.id;
    if (orgId) {
      wsManager.send('join_org', { org_id: orgId });
    }

    const unsubs = [
      wsManager.on('activity', (data: unknown) => {
        const entry = data as ActivityEntry;
        setEntries((prev) => [entry, ...prev].slice(0, maxItems));
      }),
      wsManager.on('connectionChange', (state: unknown) => {
        setWsConnected(state === 'connected');
      }),
    ];

    setWsConnected(wsManager.isConnected);

    return () => {
      unsubs.forEach((u) => u());
      if (orgId) wsManager.send('leave_org', { org_id: orgId });
    };
  }, [organization?.id, maxItems]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">
            {t('dashboard.activityFeed', 'Activity Feed')}
          </h3>
          <LiveDot connected={wsConnected} />
        </div>
        {entries.length > 0 && (
          <span className="text-xs text-gray-500">{entries.length} events</span>
        )}
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-800/50">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-kali-blue rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 mt-2">Loading activity...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500 text-sm">No recent activity</p>
            <p className="text-gray-600 text-xs mt-1">
              Activity will appear here when scans are started.
            </p>
          </div>
        ) : (
          entries.map((entry) => <ActivityItem key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}

export default ActivityFeed;
