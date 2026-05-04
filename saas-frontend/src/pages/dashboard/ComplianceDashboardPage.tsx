import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useAuth } from '../../hooks/useAuth';

interface Framework {
  id: string;
  name: string;
  fullName: string;
  version: string;
  color: string;
  categories: string[];
}

interface Posture {
  mfa_enabled: boolean;
  total_scans: number;
  completed_scans: number;
  failed_scans: number;
  scans_30d: number;
  audit_events_30d: number;
  audit_critical_30d: number;
  audit_high_30d: number;
  agents_total: number;
  users_active_30d: number;
  ip_whitelist_entries: number;
}

interface DashboardResponse {
  frameworks: Framework[];
  posture: Posture;
  assessment_status: string;
  note: string;
}

function getFrameworkColor(color: string) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
  };
  return colors[color] || colors.blue;
}

export default function ComplianceDashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('compliance.title', 'Compliance Dashboard')} — CyberSec Pro`);
  const { token } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/v1/compliance/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: DashboardResponse) => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const selected = data?.frameworks.find(f => f.id === selectedId) || null;

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('compliance.dashboardTitle', 'Compliance Dashboard')}</h1>
            <p className="text-gray-400 text-sm">{t('compliance.dashboardSubtitleReal', 'Real security posture signals from your account · Reference framework metadata for NIST, OWASP, GDPR, PCI DSS, HIPAA & SOC 2')}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-sm text-red-300">{error}</div>
        )}
        {loading && !data && (
          <div className="text-center py-12 text-gray-500 text-sm">{t('common.loading', 'Loading…')}</div>
        )}

        {data && (
          <>
            {/* Real posture signals */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                  {t('compliance.posture', 'Real Security Posture Signals')}
                </h3>
                <span className="text-xs text-gray-500">
                  {t('compliance.derivedFromAccount', 'Derived from your account data')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <SignalTile
                  label={t('compliance.mfa', 'MFA Enabled')}
                  value={data.posture.mfa_enabled ? t('common.yes', 'Yes') : t('common.no', 'No')}
                  good={data.posture.mfa_enabled}
                />
                <SignalTile label={t('compliance.totalScans', 'Total scans')} value={data.posture.total_scans.toLocaleString()} />
                <SignalTile label={t('compliance.completedScans', 'Completed scans')} value={data.posture.completed_scans.toLocaleString()} />
                <SignalTile
                  label={t('compliance.failedScans', 'Failed scans')}
                  value={data.posture.failed_scans.toLocaleString()}
                  good={data.posture.failed_scans === 0}
                  bad={data.posture.failed_scans > 0}
                />
                <SignalTile label={t('compliance.scans30d', 'Scans (30d)')} value={data.posture.scans_30d.toLocaleString()} />
                <SignalTile
                  label={t('compliance.auditEvents30d', 'Audit events (30d)')}
                  value={data.posture.audit_events_30d.toLocaleString()}
                />
                <SignalTile
                  label={t('compliance.auditCritical30d', 'Critical audit (30d)')}
                  value={data.posture.audit_critical_30d.toLocaleString()}
                  bad={data.posture.audit_critical_30d > 0}
                />
                <SignalTile
                  label={t('compliance.auditHigh30d', 'High audit (30d)')}
                  value={data.posture.audit_high_30d.toLocaleString()}
                  bad={data.posture.audit_high_30d > 0}
                />
                <SignalTile label={t('compliance.agents', 'Registered agents')} value={data.posture.agents_total.toLocaleString()} />
                <SignalTile label={t('compliance.usersActive30d', 'Active users (30d)')} value={data.posture.users_active_30d.toLocaleString()} />
                <SignalTile
                  label={t('compliance.ipWhitelist', 'IP whitelist entries')}
                  value={data.posture.ip_whitelist_entries.toLocaleString()}
                  good={data.posture.ip_whitelist_entries > 0}
                />
              </div>
            </div>

            {/* Honesty banner */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6 text-sm text-amber-200/90">
              <p className="font-medium mb-1">{t('compliance.notAssessedTitle', 'Not yet assessed')}</p>
              <p className="text-amber-200/70 text-xs">
                {data.note}
              </p>
            </div>

            {/* Framework grid */}
            {!selected && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.frameworks.map(fw => (
                  <button
                    key={fw.id}
                    onClick={() => setSelectedId(fw.id)}
                    className="text-left bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-white font-semibold">{fw.name}</h4>
                        <p className="text-gray-500 text-xs">{fw.fullName}</p>
                      </div>
                      <div className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-800 border border-gray-700 text-gray-400">
                        {t('compliance.notAssessed', 'Not assessed')}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {fw.categories.length} {t('compliance.categories', 'reference categories')} · v{fw.version}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {fw.categories.slice(0, 4).map(c => (
                        <span key={c} className="px-2 py-0.5 bg-gray-800/60 rounded text-[11px] text-gray-400 border border-gray-700/50">{c}</span>
                      ))}
                      {fw.categories.length > 4 && (
                        <span className="px-2 py-0.5 text-[11px] text-gray-500">+{fw.categories.length - 4}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Framework detail */}
            {selected && (
              <div className={`bg-gradient-to-br ${getFrameworkColor(selected.color)} border rounded-xl p-6`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selected.fullName}</h3>
                    <p className="text-gray-300 text-sm">v{selected.version} · {selected.categories.length} {t('compliance.categories', 'reference categories')}</p>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-gray-300 hover:text-white p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-300/80 mb-4">
                  {t('compliance.referenceOnly', 'Reference framework structure. Per-control compliance scoring requires a formal assessment workflow which is not yet enabled.')}
                </p>
                <div className="space-y-2">
                  {selected.categories.map(c => (
                    <div key={c} className="flex items-center justify-between bg-gray-950/40 rounded-lg p-3 border border-gray-800/50">
                      <span className="text-white text-sm">{c}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-800 border border-gray-700 text-gray-400">
                        {t('compliance.notAssessed', 'Not assessed')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}

function SignalTile({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const valueClass = bad
    ? 'text-red-400'
    : good
      ? 'text-green-400'
      : 'text-white';
  return (
    <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
      <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}
