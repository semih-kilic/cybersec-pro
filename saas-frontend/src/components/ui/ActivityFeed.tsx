/**
 * 🐉 CyberSec Pro — ActivityFeed
 * Real-time activity timeline for the dashboard
 * Shows scan events, security alerts, team actions, system updates
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export interface ActivityItem {
  id: string;
  type: 'scan_started' | 'scan_completed' | 'scan_failed' | 'vuln_found' | 'target_added' | 'report_generated' | 'user_action' | 'system';
  title: string;
  description?: string;
  timestamp: string;
  user?: { name: string; avatar?: string };
  meta?: Record<string, string | number>;
  link?: string;
  severity?: 'info' | 'success' | 'warning' | 'critical';
}

const typeConfig: Record<string, { icon: string; color: string; line: string }> = {
  scan_started:     { icon: '🚀', color: 'text-cyan-400',    line: 'bg-cyan-500/30' },
  scan_completed:   { icon: '✅', color: 'text-emerald-400', line: 'bg-emerald-500/30' },
  scan_failed:      { icon: '❌', color: 'text-red-400',     line: 'bg-red-500/30' },
  vuln_found:       { icon: '🛡️', color: 'text-amber-400',   line: 'bg-amber-500/30' },
  target_added:     { icon: '🎯', color: 'text-blue-400',    line: 'bg-blue-500/30' },
  report_generated: { icon: '📊', color: 'text-purple-400',  line: 'bg-purple-500/30' },
  user_action:      { icon: '👤', color: 'text-gray-400',    line: 'bg-gray-500/30' },
  system:           { icon: '⚙️', color: 'text-gray-500',    line: 'bg-gray-600/30' },
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function getTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

interface ActivityFeedProps {
  /** Maximum items to display */
  limit?: number;
  /** Show compact variant (less padding) */
  compact?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Filter by activity types */
  filter?: ActivityItem['type'][];
}

export function ActivityFeed({ limit = 20, compact = false, className = '', filter }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(limit);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        if (filter?.length) params.set('types', filter.join(','));

        const res = await fetch(`/api/v1/activity?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch {
        // Graceful fallback — show empty feed
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
    // Poll for updates every 45s
    const interval = setInterval(fetchActivities, 45_000);
    return () => clearInterval(interval);
  }, [limit, filter]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-800 rounded w-3/4" />
              <div className="h-2.5 bg-gray-800/60 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <div className="text-4xl mb-3">📡</div>
        <p className="text-gray-400 text-sm font-medium">No recent activity</p>
        <p className="text-gray-600 text-xs mt-1">Events will appear here as you use the platform</p>
      </div>
    );
  }

  const shown = activities.slice(0, visibleCount);

  return (
    <div className={`relative ${className}`}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-800" aria-hidden="true" />

      <AnimatePresence initial={false}>
        {shown.map((activity, index) => {
          const config = typeConfig[activity.type] || typeConfig.system;
          const Wrapper = activity.link ? Link : 'div';
          const wrapperProps = activity.link ? { to: activity.link } : {};

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className="relative"
            >
              <Wrapper
                {...(wrapperProps as any)}
                className={`flex gap-3 ${compact ? 'py-2 px-1' : 'py-3 px-2'} rounded-lg hover:bg-gray-800/30 transition-colors group cursor-default ${
                  activity.link ? 'cursor-pointer' : ''
                }`}
              >
                {/* Timeline node */}
                <div className="relative z-10 flex-shrink-0 flex items-start pt-0.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    activity.user?.avatar ? '' : 'bg-gray-800 border border-gray-700'
                  }`}>
                    {activity.user?.avatar ? (
                      <img
                        src={activity.user.avatar}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <span>{config.icon}</span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium text-gray-200 ${compact ? 'text-xs' : ''} truncate`}>
                        {activity.user && (
                          <span className="text-white font-semibold">{activity.user.name} </span>
                        )}
                        {activity.title}
                      </p>
                      {activity.description && (
                        <p className={`text-gray-500 mt-0.5 ${compact ? 'text-xs' : 'text-xs'} line-clamp-2`}>
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0 pt-0.5">
                      {getTimeAgo(activity.timestamp)}
                    </time>
                  </div>

                  {/* Severity badge */}
                  {activity.severity && activity.severity !== 'info' && (
                    <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                      severityColors[activity.severity] || severityColors.info
                    }`}>
                      {activity.severity}
                    </span>
                  )}

                  {/* Meta tags */}
                  {activity.meta && Object.keys(activity.meta).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {Object.entries(activity.meta).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-500 text-[10px] font-mono"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover arrow for linked items */}
                {activity.link && (
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </Wrapper>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Load more */}
      {activities.length > visibleCount && (
        <div className="text-center pt-3">
          <button
            onClick={() => setVisibleCount(prev => prev + 10)}
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors font-medium"
          >
            Show more ({activities.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
