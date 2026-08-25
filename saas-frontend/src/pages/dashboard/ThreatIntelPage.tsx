import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

type Feed = {
  id: string;
  name: string;
  feed_type: string;
  indicators: number;
  last_update: string;
  status: string;
  severity: string;
  source_url: string;
};

type Ioc = {
  ioc_type: string;
  value: string;
  threat: string;
  source: string;
  confidence: number;
  first_seen: string;
  last_seen: string;
  reference?: string | null;
};

type Apt = {
  name: string;
  mitre_id: string;
  origin: string;
  targets: string;
  ttps: string[];
  reference: string;
};

type Stats = {
  active_threats: number;
  iocs_tracked: number;
  kev_total: number;
  kev_added_30d: number;
};

type IntelResponse = {
  feeds: Feed[];
  iocs: Ioc[];
  stats: Stats;
  apt_groups: Apt[];
  fetched_at: string;
};

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}

function getConfidenceColor(c: number) {
  if (c >= 90) return 'text-red-400';
  if (c >= 70) return 'text-orange-400';
  if (c >= 50) return 'text-yellow-400';
  return 'text-green-400';
}

function relativeTime(iso: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function compactNumber(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function ThreatIntelPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('threatIntel.title', 'Threat Intelligence')} — CyberSec Pro`);
  const [activeTab, setActiveTab] = useState<'overview' | 'feeds' | 'iocs' | 'apt'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<IntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      setErr(null);
      if (force) setRefreshing(true);
      const jwt = localStorage.getItem('token') || '';
      const params = new URLSearchParams();
      if (force) params.set('refresh', 'true');
      const res = await fetch('/api/v1/threat-intel?' + params.toString(), {
        headers: jwt ? { Authorization: 'Bearer ' + jwt } : {},
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json: IntelResponse = await res.json();
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const feeds = data?.feeds ?? [];
  const iocs = data?.iocs ?? [];
  const stats = data?.stats;
  const aptGroups = data?.apt_groups ?? [];

  const filteredIOCs = useMemo(() => {
    if (!searchQuery) return iocs;
    const q = searchQuery.toLowerCase();
    return iocs.filter(ioc =>
      ioc.value.toLowerCase().includes(q) ||
      ioc.threat.toLowerCase().includes(q) ||
      ioc.ioc_type.toLowerCase().includes(q)
    );
  }, [searchQuery, iocs]);

  const tabs = [
    { id: 'overview' as const, label: t('threatIntel.overview', 'Overview'), icon: '📊' },
    { id: 'feeds' as const, label: t('threatIntel.feeds', 'Threat Feeds'), icon: '📡' },
    { id: 'iocs' as const, label: t('threatIntel.iocsTab', 'IOCs'), icon: '🎯' },
    { id: 'apt' as const, label: t('threatIntel.aptTab', 'APT Groups'), icon: '👤' },
  ];

  const statCards = stats ? [
    { label: t('threatIntel.kevTotal', 'CISA KEV Catalog'), value: compactNumber(stats.kev_total), sub: `+${stats.kev_added_30d} ${t('threatIntel.last30d', 'in last 30d')}` },
    { label: t('threatIntel.iocsTracked', 'IOCs Tracked (live feeds)'), value: compactNumber(stats.iocs_tracked), sub: t('threatIntel.fromAbusech', 'from URLhaus + ThreatFox') },
    { label: t('threatIntel.activeFeedsLabel', 'Active Feeds'), value: feeds.length.toString(), sub: t('threatIntel.publicSources', 'public sources') },
    { label: t('threatIntel.aptGroupsLabel', 'APT Groups (MITRE ATT&CK)'), value: aptGroups.length.toString(), sub: t('threatIntel.curated', 'curated reference') },
  ] : [];

  return (
    <PageTransition>
      <div className="scope-dark p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('threatIntel.title', 'Threat Intelligence')}</h1>
              <p className="text-gray-400 text-sm">{t('threatIntel.subtitle', 'Live threat data from CISA KEV, abuse.ch URLhaus, abuse.ch ThreatFox & MITRE ATT&CK')}</p>
              {data && (
                <p className="text-gray-600 text-xs mt-1">
                  {t('threatIntel.fetchedAt', 'Fetched')}: {relativeTime(data.fetched_at)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 rounded-lg text-sm text-gray-200 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? t('common.refreshing', 'Refreshing...') : t('common.refresh', 'Refresh')}
          </button>
        </div>

        {err && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {t('common.error', 'Error')}: {err}
          </div>
        )}

        {loading && !data && (
          <div className="text-gray-400 text-sm py-12 text-center">{t('common.loading', 'Loading...')}</div>
        )}

        {data && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-900/50 p-1 rounded-xl border border-gray-800 w-fit">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gray-800 text-white shadow-lg'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {statCards.map(stat => (
                    <div key={stat.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                      <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <p className="text-gray-500 text-xs mt-1">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">{t('threatIntel.recentIocs', 'Most Recent Indicators of Compromise')}</h3>
                  {iocs.length === 0 ? (
                    <p className="text-gray-500 text-sm">{t('threatIntel.noIocs', 'No recent indicators available.')}</p>
                  ) : (
                    <div className="space-y-2">
                      {iocs.slice(0, 8).map((ioc, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-gray-950/50 rounded-lg border border-gray-800/50">
                          <span className="px-2 py-1 bg-gray-800 rounded text-xs font-mono text-gray-300 w-16 text-center">{ioc.ioc_type}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-cyan-400 text-sm font-mono truncate">{ioc.value}</p>
                            <p className="text-gray-500 text-xs">{ioc.threat} · {ioc.source}</p>
                          </div>
                          <span className={`text-xs font-bold ${getConfidenceColor(ioc.confidence)}`}>{ioc.confidence}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feeds */}
            {activeTab === 'feeds' && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                  <h3 className="text-lg font-semibold text-white">{t('threatIntel.activeFeeds', 'Active Threat Feeds')}</h3>
                  <p className="text-gray-400 text-sm mt-1">{t('threatIntel.feedsDesc', 'Live counts pulled directly from each provider\'s public API')}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.feed', 'Feed')}</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('common.type', 'Type')}</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.indicators', 'Indicators')}</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('common.severity', 'Severity')}</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('common.status', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeds.map(feed => (
                        <tr key={feed.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-white font-medium">
                            <a href={feed.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400">
                              {feed.name}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">{feed.feed_type}</td>
                          <td className="px-4 py-3 text-sm text-cyan-400 font-mono">{feed.indicators.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getSeverityColor(feed.severity)}`}>{feed.severity}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-sm text-green-400">
                              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                              {feed.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* IOCs */}
            {activeTab === 'iocs' && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder={t('threatIntel.searchPlaceholder', 'Search IOCs by IP, domain, hash, or threat type...')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('common.type', 'Type')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.indicator', 'Indicator')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.threat', 'Threat')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.source', 'Source')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.confidence', 'Confidence')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.firstSeen', 'First Seen')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('threatIntel.lastSeen', 'Last Seen')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIOCs.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">{t('threatIntel.noResults', 'No matching indicators.')}</td></tr>
                        ) : filteredIOCs.map((ioc, i) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-gray-800 rounded text-xs font-mono text-gray-300">{ioc.ioc_type}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-cyan-400 font-mono">
                              {ioc.reference ? (
                                <a href={ioc.reference} target="_blank" rel="noopener noreferrer" className="hover:underline">{ioc.value}</a>
                              ) : ioc.value}
                            </td>
                            <td className="px-4 py-3 text-sm text-white">{ioc.threat}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{ioc.source}</td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-bold ${getConfidenceColor(ioc.confidence)}`}>{ioc.confidence}%</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{ioc.first_seen}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{ioc.last_seen}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* APT */}
            {activeTab === 'apt' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {aptGroups.map((apt, i) => (
                  <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-white font-semibold">{apt.name}</h4>
                        <p className="text-gray-500 text-sm">{t('threatIntel.origin', 'Origin')}: {apt.origin}</p>
                      </div>
                      <a href={apt.reference} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 rounded text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20">
                        {apt.mitre_id}
                      </a>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">{t('threatIntel.targetsLabel', 'Targets:')}</span>
                        <span className="text-gray-300 ml-2">{apt.targets}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">{t('threatIntel.ttps', 'TTPs:')}</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {apt.ttps.map(ttp => (
                            <span key={ttp} className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">{ttp}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
