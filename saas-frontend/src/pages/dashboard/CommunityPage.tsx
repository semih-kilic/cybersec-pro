import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useAuth } from '../../hooks/useAuth';

const FORUM_CATEGORIES = ['All', 'General', 'Tools & Techniques', 'CTF Write-ups', 'Bug Bounty', 'Career', 'News Discussion'] as const;

interface Post {
  id: string;
  user_id: string;
  author: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  like_count: number;
  reply_count: number;
  view_count: number;
  created_at: string;
}

interface Stats { members: number; discussions: number; replies: number; online_now: number; }
interface LbEntry { rank: number; user_id: string; name: string; points: number; contributions: number; posts: number; replies: number; scans: number; }
interface MyRank { rank: number; points: number; contributions: number; posts: number; replies: number; scans: number; }

function relativeTime(iso: string) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const d = (Date.now() - t) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

export default function CommunityPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('community.title', 'Community')} — CyberSec Pro`);
  const { user, token } = useAuth();

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discussions' | 'leaderboard'>('discussions');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);

  // Real data state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LbEntry[]>([]);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New post form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('General');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [posting, setPosting] = useState(false);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

  const loadPosts = useCallback(async () => {
    if (!token) return;
    setPostsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'All') params.set('category', activeCategory);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      params.set('limit', '50');
      const res = await fetch(`/api/v1/community/posts?${params}`, { headers: authHeader });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setPostsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeCategory, searchQuery]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/community/stats', { headers: authHeader });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadLeaderboard = useCallback(async () => {
    if (!token) return;
    try {
      const [lbRes, meRes] = await Promise.all([
        fetch('/api/v1/community/leaderboard', { headers: authHeader }),
        fetch('/api/v1/community/me/rank', { headers: authHeader }),
      ]);
      if (lbRes.ok) {
        const d = await lbRes.json();
        setLeaderboard(d.leaderboard || []);
      }
      if (meRes.ok) setMyRank(await meRes.json());
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (activeTab === 'leaderboard') loadLeaderboard(); }, [activeTab, loadLeaderboard]);

  const submitPost = async () => {
    if (!token || posting) return;
    if (!newTitle.trim() || !newContent.trim()) return;
    setPosting(true);
    try {
      const tags = newTags.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/v1/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader || {}) },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim(), category: newCategory, tags }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowNewPost(false);
      setNewTitle(''); setNewContent(''); setNewTags(''); setNewCategory('General');
      await Promise.all([loadPosts(), loadStats()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Post failed');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/community/posts/${post.id}/like`, {
        method: 'POST',
        headers: authHeader,
      });
      if (res.ok) {
        const d = await res.json();
        setPosts(ps => ps.map(p => p.id === post.id ? { ...p, like_count: d.like_count } : p));
        if (selectedPost && selectedPost.id === post.id) {
          setSelectedPost({ ...selectedPost, like_count: d.like_count });
        }
      }
    } catch { /* ignore */ }
  };

  const statTiles = stats ? [
    { label: t('community.stats.members', 'Members'), value: stats.members.toLocaleString() },
    { label: t('community.stats.discussions', 'Discussions'), value: stats.discussions.toLocaleString() },
    { label: t('community.stats.replies', 'Replies'), value: stats.replies.toLocaleString() },
    { label: t('community.stats.online', 'Online (15m)'), value: stats.online_now.toLocaleString() },
  ] : [];

  return (
    <PageTransition>
      <div className="scope-dark p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('community.title', 'Community')}</h1>
            <p className="text-gray-400 text-sm">{t('community.subtitleReal', 'Real discussions from CyberSec Pro members. No bots, no fake stats.')}</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statTiles.map(s => (
              <div key={s.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-500 text-xs">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900/50 p-1 rounded-xl border border-gray-800 w-fit">
          <button
            onClick={() => setActiveTab('discussions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'discussions' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          >💬 {t('community.tabDiscussions', 'Discussions')}</button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'leaderboard' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          >🏆 {t('community.tabLeaderboard', 'Leaderboard')}</button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-sm text-red-300">{error}</div>
        )}

        {activeTab === 'discussions' && (
          <>
            {/* Search + New Post */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={t('community.searchPlaceholder', 'Search discussions, content...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <button onClick={() => setShowNewPost(true)} className="px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-sm text-purple-400 font-medium transition-colors whitespace-nowrap">
                + {t('community.newDiscussion', 'New Discussion')}
              </button>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2 mb-6">
              {FORUM_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                      : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border border-gray-800'
                  }`}
                >{cat}</button>
              ))}
            </div>

            {/* Posts */}
            {postsLoading ? (
              <div className="text-center py-12 text-gray-500 text-sm">{t('common.loading', 'Loading…')}</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 bg-gray-900/30 border border-gray-800 rounded-xl">
                <p className="text-gray-400 mb-2 text-base">{t('community.noPosts', 'No discussions yet.')}</p>
                <p className="text-gray-600 text-sm mb-4">{t('community.beTheFirst', 'Be the first to start a conversation in this category.')}</p>
                <button onClick={() => setShowNewPost(true)} className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-sm text-purple-400">
                  + {t('community.newDiscussion', 'New Discussion')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => (
                  <div key={post.id} onClick={() => setSelectedPost(post)} className={`bg-gray-900/50 border rounded-xl p-5 hover:border-gray-700 transition-colors cursor-pointer ${post.pinned ? 'border-purple-500/30' : 'border-gray-800'}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-gray-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {post.author.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {post.pinned && <span className="text-xs text-purple-400 font-bold">📌 PINNED</span>}
                          <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">{post.category}</span>
                        </div>
                        <h3 className="text-white font-medium mb-1">{post.title}</h3>
                        <p className="text-gray-400 text-sm line-clamp-1 mb-2">{post.content}</p>
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {post.tags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 bg-gray-800/50 rounded text-[11px] text-gray-500 border border-gray-700/50">#{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{t('community.by', 'by')} <span className="text-gray-300">{post.author}</span></span>
                          <span>{relativeTime(post.created_at)}</span>
                          <span>💬 {post.reply_count}</span>
                          <span>👁 {post.view_count.toLocaleString()}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLike(post); }}
                            className="hover:text-pink-400 transition-colors"
                          >❤️ {post.like_count}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* My Rank */}
            {myRank && (
              <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-xl p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xl font-bold text-white">
                    {user?.first_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'You'}</p>
                    <p className="text-gray-400 text-sm">
                      {t('community.rank', 'Rank')} #{myRank.rank} · {myRank.points.toLocaleString()} {t('community.points', 'points')} · {myRank.contributions} {t('community.contributions', 'contributions')}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {myRank.posts} {t('community.posts', 'posts')} · {myRank.replies} {t('community.replies', 'replies')} · {myRank.scans} {t('community.scans', 'completed scans')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-cyan-400 font-bold text-lg">{myRank.points.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs">{t('community.points', 'points')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top Contributors */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-white">{t('community.topContributors', 'Top Contributors')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('community.scoringFormula', 'Score = posts × 5 + replies × 2 + completed scans × 1')}</p>
              </div>
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">{t('common.loading', 'Loading…')}</div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {leaderboard.map(entry => {
                    const badge = entry.rank === 1 ? '🏆' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '⭐';
                    return (
                      <div key={entry.user_id} className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors">
                        <span className="text-lg w-8 text-center">{badge}</span>
                        <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                          #{entry.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{entry.name}</p>
                          <p className="text-gray-500 text-xs">{entry.contributions} {t('community.contributions', 'contributions')} · {entry.posts}p / {entry.replies}r / {entry.scans}s</p>
                        </div>
                        <div className="text-right">
                          <p className="text-cyan-400 font-bold">{entry.points.toLocaleString()}</p>
                          <p className="text-gray-600 text-xs">{t('community.points', 'points')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Post Detail Modal */}
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPost(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">{selectedPost.category}</span>
                  {selectedPost.pinned && <span className="text-xs text-purple-400 font-bold">📌 PINNED</span>}
                </div>
                <button onClick={() => setSelectedPost(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <h2 className="text-xl font-bold text-white mb-3">{selectedPost.title}</h2>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-gray-700 flex items-center justify-center text-xs font-bold text-white">
                  {selectedPost.author.charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-300 text-sm font-medium">{selectedPost.author}</span>
                <span className="text-gray-600 text-sm">·</span>
                <span className="text-gray-500 text-sm">{relativeTime(selectedPost.created_at)}</span>
              </div>
              <p className="text-gray-300 leading-relaxed mb-4 whitespace-pre-wrap">{selectedPost.content}</p>
              {selectedPost.tags && selectedPost.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedPost.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 border border-gray-700">#{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-6 text-sm text-gray-500 mb-6 pb-4 border-b border-gray-800">
                <span>💬 {selectedPost.reply_count} {t('community.replies', 'replies')}</span>
                <span>👁 {selectedPost.view_count.toLocaleString()} {t('community.views', 'views')}</span>
                <button onClick={() => toggleLike(selectedPost)} className="hover:text-pink-400 transition-colors">❤️ {selectedPost.like_count} {t('community.likes', 'likes')}</button>
              </div>
              <button onClick={() => setSelectedPost(null)} className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors text-sm">
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        )}

        {/* New Discussion Modal */}
        {showNewPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewPost(false)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">{t('community.newDiscussion', 'New Discussion')}</h2>
                <button onClick={() => setShowNewPost(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('community.form.titleLabel', 'Title')}</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder={t('community.form.titlePlaceholder', "What's on your mind?")}
                    maxLength={200}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('community.form.categoryLabel', 'Category')}</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  >
                    {FORUM_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('community.form.tagsLabel', 'Tags (comma-separated, optional)')}</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    placeholder={t("community.tagsPlaceholder", "nmap, recon, web-pentest")}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('community.form.contentLabel', 'Content')}</label>
                  <textarea
                    rows={5}
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    maxLength={10000}
                    placeholder={t('community.form.contentPlaceholder', 'Share your thoughts, questions, or findings...')}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={submitPost}
                    disabled={posting || !newTitle.trim() || !newContent.trim()}
                    className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm"
                  >
                    {posting ? t('common.loading', 'Loading…') : t('community.postDiscussion', 'Post Discussion')}
                  </button>
                  <button onClick={() => setShowNewPost(false)} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors text-sm">
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
