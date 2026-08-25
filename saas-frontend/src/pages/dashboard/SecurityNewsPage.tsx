/**
 * SecurityNewsPage
 *
 * Real-time security news aggregator. Pulls from backend
 * GET /api/v1/security-news which fetches RSS from BleepingComputer,
 * The Hacker News, Krebs on Security, Dark Reading, CISA Alerts, and
 * SANS ISC, classifies into categories, dedupes, and caches 30 minutes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  source: string;
  category: string;
  published_at: string;
  published_ts: number;
  tags: string[];
}

interface NewsResponse {
  items: NewsItem[];
  categories: string[];
  sources: string[];
  count: number;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'Breaches': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'Vulnerabilities': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'Malware': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    case 'Policy': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'Research': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    case 'Tools': return 'text-green-400 bg-green-500/10 border-green-500/30';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}

const DEFAULT_CATEGORIES = ['All', 'Breaches', 'Vulnerabilities', 'Malware', 'Policy', 'Research', 'Tools'];

export default function SecurityNewsPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('securityNews.title', 'Security News')} — CyberSec Pro`);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      setErr(null);
      if (force) setRefreshing(true);
      const jwt = localStorage.getItem('token') || '';
      const params = new URLSearchParams({ limit: '60' });
      if (force) params.set('refresh', 'true');
      const res = await fetch('/api/v1/security-news?' + params.toString(), {
        headers: jwt ? { Authorization: 'Bearer ' + jwt } : {},
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json: NewsResponse = await res.json();
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const allItems = data?.items ?? [];
  const categories = data?.categories ?? DEFAULT_CATEGORIES;

  const filteredNews = useMemo(() => {
    return allItems.filter(news => {
      const matchCategory = activeCategory === 'All' || news.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q
        || news.title.toLowerCase().includes(q)
        || news.summary.toLowerCase().includes(q)
        || news.tags.some(tg => tg.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [allItems, activeCategory, searchQuery]);

  const featuredNews = useMemo(() => allItems.slice(0, 2), [allItems]);

  return (
    <PageTransition>
      <div className="scope-dark p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('securityNews.title', 'Security News Feed')}</h1>
              <p className="text-gray-400 text-sm">{t('securityNews.subtitle', 'Live aggregation from BleepingComputer, Krebs, Dark Reading, CISA, SANS ISC, The Hacker News')}</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="px-3 py-2 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:border-cyan-500/40 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-500">{t('common.loading', 'Loading…')}</div>
        )}

        {err && !loading && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            Failed to load news feed: {err}. Try refreshing.
          </div>
        )}

        {!loading && !err && (
          <>
            {/* Featured */}
            {featuredNews.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                {featuredNews.map(news => (
                  <div key={news.id} onClick={() => setSelectedNews(news)} className="relative bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/30 transition-colors group cursor-pointer">
                    <div className="absolute top-4 right-4">
                      <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-[10px] font-bold text-cyan-400 uppercase">{t('securityNews.featured', 'Featured')}</span>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(news.category)} mb-3`}>
                      {news.category}
                    </span>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">{news.title}</h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{news.summary}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{news.source}</span>
                      <span>·</span>
                      <span>{relativeTime(news.published_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search + Category */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={t('securityNews.searchPlaceholder', 'Search news, topics, tags...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-3">
              {filteredNews.map(news => (
                <div key={news.id} onClick={() => setSelectedNews(news)} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(news.category)}`}>
                          {news.category}
                        </span>
                        <span className="text-gray-600 text-xs">{relativeTime(news.published_at)}</span>
                      </div>
                      <h3 className="text-white font-medium mb-1">{news.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2 mb-2">{news.summary}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{news.source}</span>
                      </div>
                      {news.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {news.tags.slice(0, 6).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-gray-800 rounded text-[11px] text-gray-500 border border-gray-700/50">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredNews.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">{t('securityNews.noArticles', 'No news articles match your criteria.')}</p>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {selectedNews && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedNews(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(selectedNews.category)}`}>
                    {selectedNews.category}
                  </span>
                  <span className="text-gray-500 text-xs">{relativeTime(selectedNews.published_at)}</span>
                </div>
                <button onClick={() => setSelectedNews(null)} className="text-gray-400 hover:text-white transition-colors text-xl">{t("securityNews.closeButton", "✕")}</button>
              </div>

              <h2 className="text-xl font-bold text-white mb-3">{selectedNews.title}</h2>

              <div className="flex items-center gap-3 text-xs text-gray-500 mb-4 pb-4 border-b border-gray-800">
                <span className="font-medium text-gray-400">{selectedNews.source}</span>
                <span>·</span>
                <span>{new Date(selectedNews.published_at).toLocaleString()}</span>
              </div>

              <div className="text-gray-300 leading-relaxed space-y-4 mb-6">
                <p>{selectedNews.summary}</p>
                <p className="text-gray-400 text-sm">Aggregated from {selectedNews.source} via public RSS feed. Read the full article at the source for complete coverage.</p>
              </div>

              {selectedNews.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {selectedNews.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 border border-gray-700">#{tag}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {selectedNews.link && (
                  <a
                    href={selectedNews.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-xl transition-colors text-sm text-center font-medium"
                  >
                    Open original article ↗
                  </a>
                )}
                <button
                  onClick={() => setSelectedNews(null)}
                  className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
