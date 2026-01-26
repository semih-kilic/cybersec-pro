import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Search } from 'lucide-react';
import { apiUrl } from '../config/api';

interface AuditLogEntry {
  timestamp: string;
  action: string;
  user_id?: number | null;
  ip?: string;
  status?: string;
  host?: string;
  port?: number;
  error?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<'unknown' | 'ok' | 'failed'>('unknown');
  const [integrityMeta, setIntegrityMeta] = useState<{ total: number; verified: number; failures: number; chain_breaks: number; skipped: number } | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(apiUrl('/api/audit/logs?limit=200'), { headers });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Audit log access denied.');
      }
      const data = await response.json();
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      const message = error instanceof Error ? error.message : 'Failed to load audit logs.';
      setErrorMessage(message === 'Admin IP not allowed'
        ? 'Admin IP not allowed. Add your IP to ADMIN_ALLOWED_IPS in /etc/cybersec/admin.env.'
        : message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(apiUrl(`/api/audit/logs/export?format=${format}&limit=500`), { headers });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Audit log export denied.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download audit logs:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to download audit logs.');
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const checkIntegrity = async () => {
    setErrorMessage(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(apiUrl('/api/audit/integrity?limit=1000'), { headers });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Integrity check denied.');
      }
      const data = await response.json();
      const status = data?.status === 'ok' ? 'ok' : 'failed';
      setIntegrityStatus(status);
      setIntegrityMeta({
        total: data?.total ?? 0,
        verified: data?.verified ?? 0,
        failures: data?.failures ?? 0,
        chain_breaks: data?.chain_breaks ?? 0,
        skipped: data?.skipped ?? 0
      });
    } catch (error) {
      console.error('Failed to verify audit integrity:', error);
      setIntegrityStatus('failed');
      const message = error instanceof Error ? error.message : 'Failed to verify audit integrity.';
      setErrorMessage(message === 'Admin IP not allowed'
        ? 'Admin IP not allowed. Add your IP to ADMIN_ALLOWED_IPS in /etc/cybersec/admin.env.'
        : message);
    }
  };

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => {
      const blob = [
        log.action,
        log.status,
        log.ip,
        log.host,
        log.error,
        log.user_id?.toString(),
        log.port?.toString()
      ].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(needle);
    });
  }, [logs, query]);

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <ShieldCheck className="w-8 h-8" />
            Audit Logs
          </h1>
          <p className="text-gray-400 mt-2">Security-sensitive actions and terminal activity</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkIntegrity}
            className={`px-4 py-2 rounded-lg border ${integrityStatus === 'ok'
              ? 'border-green-500/40 text-green-300'
              : integrityStatus === 'failed'
                ? 'border-red-500/40 text-red-300'
                : 'border-dark-border text-gray-300'}
              hover:bg-dark-bg`}
          >
            {integrityStatus === 'ok' ? 'Integrity OK' : integrityStatus === 'failed' ? 'Integrity Failed' : 'Check Integrity'}
          </button>
          <button
            onClick={() => downloadLogs('json')}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-bg"
          >
            Download JSON
          </button>
          <button
            onClick={() => downloadLogs('csv')}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-bg"
          >
            Download CSV
          </button>
          <button
            onClick={loadLogs}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-bg flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="glass rounded-xl p-4 mb-6 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by action, IP, host, error..."
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      {integrityMeta && (
        <div className="glass rounded-xl p-4 mb-6 text-sm text-gray-300 flex flex-wrap gap-4">
          <span>Total: {integrityMeta.total}</span>
          <span>Verified: {integrityMeta.verified}</span>
          <span>Failures: {integrityMeta.failures}</span>
          <span>Chain breaks: {integrityMeta.chain_breaks}</span>
          <span>Skipped: {integrityMeta.skipped}</span>
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-dark-border text-sm text-gray-400 flex justify-between">
          <span>Latest {filteredLogs.length} events</span>
          <span>{loading ? 'Loading...' : 'Live'}</span>
        </div>
        <div className="divide-y divide-dark-border">
          {filteredLogs.length === 0 && !loading && (
            <div className="p-6 text-center text-gray-500">No audit events found.</div>
          )}
          {filteredLogs.map((log, index) => (
            <div key={`${log.timestamp}-${index}`} className="p-4 grid grid-cols-1 md:grid-cols-6 gap-2 text-sm">
              <div className="text-gray-400 md:col-span-1">{new Date(log.timestamp).toLocaleString()}</div>
              <div className="font-semibold md:col-span-1">{log.action}</div>
              <div className="md:col-span-1 text-gray-300">{log.status || '-'}</div>
              <div className="md:col-span-1 text-gray-300">{log.ip || '-'}</div>
              <div className="md:col-span-1 text-gray-300">{log.host ? `${log.host}${log.port ? `:${log.port}` : ''}` : '-'}</div>
              <div className="md:col-span-1 text-red-300 truncate">{log.error || ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
