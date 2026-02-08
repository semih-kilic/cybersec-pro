import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

interface ScanTool {
  id: string;
  name: string;
  category?: string;
}

interface ScanFindingsSummary {
  total?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  open_ports?: number;
}

interface Scan {
  id: string;
  tool?: ScanTool;
  tool_name?: string; // Legacy fallback
  target: string;
  status: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled' | 'pending' | 'timeout';
  started_at: string;
  completed_at?: string;
  created_at?: string;
  duration?: string;
  duration_seconds?: number;
  findings_summary?: ScanFindingsSummary;
  findings_count?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  command?: string;
  output?: string;
  error_log?: string;
}

// Helper to get tool name from scan
const getToolName = (scan: Scan): string => {
  if (scan.tool?.name) return scan.tool.name;
  if (scan.tool_name) return scan.tool_name;
  return 'Unknown';
};

// Helper to get findings
const getFindings = (scan: Scan): ScanFindingsSummary => {
  if (scan.findings_summary) return scan.findings_summary;
  return {
    total: scan.findings_count || 0,
    critical: scan.critical || 0,
    high: scan.high || 0,
    medium: scan.medium || 0,
    low: scan.low || 0,
  };
};

const statusColors: Record<string, string> = {
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  queued: 'bg-yellow-500',
  cancelled: 'bg-gray-500',
  pending: 'bg-gray-500',
  timeout: 'bg-orange-500',
};

const statusIcons: Record<string, React.ReactNode> = {
  running: (
    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  completed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  failed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  queued: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  cancelled: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  pending: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  timeout: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function ScansPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(searchParams.get('status') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'live'>('list');
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetchScans();
    // Poll for updates every 5 seconds if there are running scans
    const interval = setInterval(() => {
      if (scans.some(s => s.status === 'running')) {
        fetchScans();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchScans = async () => {
    try {
      const res = await fetch('/api/v1/scans', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScans(data.scans || []);
      } else {
        // If API fails, show empty state instead of mock data
        setScans([]);
      }
    } catch (error) {
      console.error('Failed to fetch scans:', error);
      // Show empty state on error - no mock data
      setScans([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelScan = async (scanId: string) => {
    try {
      // Try v2 endpoint first, then legacy
      let res = await fetch(`/api/v1/scan/${scanId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        res = await fetch(`/api/v1/scans/${scanId}/cancel`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
      fetchScans();
    } catch (error) {
      console.error('Failed to cancel scan:', error);
    }
  };

  const rerunScan = async (scan: Scan) => {
    setRerunningId(scan.id);
    setNotification(null);
    
    try {
      const res = await fetch(`/api/v1/scans/${scan.id}/rerun`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Success - refresh scan list to show new scan
        fetchScans();
        setNotification({ type: 'success', message: `Scan restarted! Running on ${data.target}` });
        // Close any open modal
        setSelectedScan(null);
        // Auto-hide notification after 5s
        setTimeout(() => setNotification(null), 5000);
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to rerun scan' });
      }
    } catch (error) {
      console.error('Failed to rerun scan:', error);
      setNotification({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setRerunningId(null);
    }
  };

  const filteredScans = scans.filter(scan => {
    const matchesFilter = filter === 'all' || scan.status === filter;
    const toolName = getToolName(scan);
    const matchesSearch = 
      toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (scan.target || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const runningScans = scans.filter(s => s.status === 'running');
  const completedScans = scans.filter(s => s.status === 'completed');
  const failedScans = scans.filter(s => ['failed', 'timeout'].includes(s.status));

  const formatDuration = (scan: Scan): string => {
    // If API provides duration string, use it
    if (scan.duration) return scan.duration;
    // If seconds provided, format
    if (scan.duration_seconds) {
      const secs = scan.duration_seconds;
      if (secs < 60) return `${Math.round(secs)}s`;
      if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
      return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
    }
    // Calculate from timestamps
    if (scan.started_at && scan.completed_at) {
      const start = new Date(scan.started_at);
      const end = new Date(scan.completed_at);
      const secs = (end.getTime() - start.getTime()) / 1000;
      if (secs < 60) return `${Math.round(secs)}s`;
      if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
      return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
    }
    return '-';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading scans...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="Scans"
        subtitle="View and manage your security scans"
      />

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white`}>
          {notification.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-80">✕</button>
        </div>
      )}

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{scans.length}</p>
                <p className="text-sm text-gray-400">Total Scans</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-400">{runningScans.length}</p>
                <p className="text-sm text-gray-400">Running</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-400">{completedScans.length}</p>
                <p className="text-sm text-gray-400">Completed</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-400">{failedScans.length}</p>
                <p className="text-sm text-gray-400">Failed</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by tool or target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {['all', 'running', 'completed', 'failed', 'queued'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  filter === status 
                    ? 'bg-kali-blue text-white' 
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded text-sm ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('live')}
              className={`px-4 py-2 rounded text-sm ${viewMode === 'live' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
            >
              Live
            </button>
          </div>

          {/* New Scan */}
          <Link
            to="/dashboard/scans/new"
            className="px-6 py-2 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-medium rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Scan
          </Link>
        </div>

        {/* Scans List/Grid */}
        {viewMode === 'list' ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Tool</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Started</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Findings</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.map((scan) => {
                  const toolName = getToolName(scan);
                  const findings = getFindings(scan);
                  return (
                  <tr 
                    key={scan.id} 
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition cursor-pointer"
                    onClick={() => setSelectedScan(scan)}
                  >
                    <td className="px-5 py-4">
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusColors[scan.status] || 'bg-gray-500'}`}>
                        {statusIcons[scan.status]}
                        <span className="capitalize">{scan.status}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-white font-medium">{toolName}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-300 font-mono text-sm">{scan.target}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {formatDate(scan.started_at || scan.created_at || '')}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {scan.status === 'running' ? (
                        <span className="text-blue-400">In progress...</span>
                      ) : (
                        formatDuration(scan)
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {(findings.total || 0) > 0 || (findings.open_ports || 0) > 0 ? (
                        <div className="flex items-center gap-1">
                          {(findings.critical || 0) > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">{findings.critical}C</span>
                          )}
                          {(findings.high || 0) > 0 && (
                            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">{findings.high}H</span>
                          )}
                          {(findings.medium || 0) > 0 && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">{findings.medium}M</span>
                          )}
                          {(findings.low || 0) > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">{findings.low}L</span>
                          )}
                          {(findings.open_ports || 0) > 0 && !(findings.critical || findings.high || findings.medium || findings.low) && (
                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">{findings.open_ports} ports</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        {scan.status === 'running' ? (
                          <button
                            onClick={() => cancelScan(scan.id)}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => rerunScan(scan)}
                            disabled={rerunningId === scan.id}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition disabled:opacity-50 disabled:cursor-wait"
                          >
                            {rerunningId === scan.id ? 'Starting...' : 'Rerun'}
                          </button>
                        )}
                        <Link
                          to={`/dashboard/scans/${scan.id}`}
                          className="px-3 py-1.5 bg-kali-blue/20 text-kali-blue hover:bg-kali-blue/30 rounded text-sm transition"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredScans.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No scans found</h3>
                <p className="text-gray-400 mb-4">Start your first security scan to see results here.</p>
                <Link 
                  to="/dashboard/scans/new"
                  className="inline-flex items-center gap-2 px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Scan
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* Live View - Real-time monitoring */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {runningScans.length > 0 ? (
              runningScans.map(scan => (
                <div key={scan.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                      <div>
                        <h3 className="text-white font-medium">{getToolName(scan)}</h3>
                        <p className="text-sm text-gray-400">{scan.target}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => cancelScan(scan.id)}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition"
                    >
                      Stop
                    </button>
                  </div>
                  <div className="h-64 bg-gray-950 p-4 overflow-auto font-mono text-sm">
                    <pre ref={outputRef} className="text-green-400 whitespace-pre-wrap">
                      {`$ ${scan.command}\n`}
                      {`[*] Starting scan on ${scan.target}...\n`}
                      {`[*] Initializing modules...\n`}
                      {`[+] Connection established\n`}
                      {`[*] Scanning in progress...\n`}
                      <span className="animate-pulse">█</span>
                    </pre>
                  </div>
                </div>
              ))
            ) : (
              <div className="lg:col-span-2 text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No running scans</h3>
                <p className="text-gray-400">Start a new scan to see live output here.</p>
              </div>
            )}
          </div>
        )}

        {/* Scan Detail Modal */}
        {selectedScan && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedScan(null)}
          >
            <div 
              className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedScan.tool_name} Scan</h2>
                  <p className="text-sm text-gray-400">{selectedScan.target}</p>
                </div>
                <button
                  onClick={() => setSelectedScan(null)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-auto max-h-[calc(90vh-200px)]">
                {/* Scan Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Status</p>
                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusColors[selectedScan.status]}`}>
                      {statusIcons[selectedScan.status]}
                      <span className="capitalize">{selectedScan.status}</span>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Started</p>
                    <p className="text-white">{new Date(selectedScan.started_at).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Duration</p>
                    <p className="text-white">{formatDuration(selectedScan)}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Findings</p>
                    <p className="text-white">{selectedScan.findings_count || 0}</p>
                  </div>
                </div>

                {/* Command */}
                <div className="mb-6">
                  <h4 className="text-sm text-gray-400 mb-2">Command</h4>
                  <div className="bg-gray-950 rounded-lg p-4">
                    <code className="text-green-400 font-mono text-sm">{selectedScan.command}</code>
                  </div>
                </div>

                {/* Output Preview */}
                <div>
                  <h4 className="text-sm text-gray-400 mb-2">Output</h4>
                  <div className="bg-gray-950 rounded-lg p-4 h-64 overflow-auto">
                    <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                      {selectedScan.output || 'Scan output will appear here when available...'}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => rerunScan(selectedScan)}
                  disabled={rerunningId === selectedScan.id}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-wait"
                >
                  {rerunningId === selectedScan.id ? 'Starting...' : 'Rerun Scan'}
                </button>
                <Link
                  to={`/dashboard/reports/new?scan=${selectedScan.id}`}
                  className="px-4 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg transition"
                >
                  Generate Report
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScansPage;
