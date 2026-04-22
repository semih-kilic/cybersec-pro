import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useAuth } from '../../hooks/useAuth';

const FORUM_CATEGORIES = ['All', 'General', 'Tools & Techniques', 'CTF Write-ups', 'Bug Bounty', 'Career', 'News Discussion'] as const;

const FORUM_POSTS = [
  {
    id: 1,
    title: 'Best methodology for web application penetration testing in 2026?',
    author: 'pen_tester_pro',
    avatar: '🔴',
    category: 'Tools & Techniques',
    replies: 42,
    views: 1847,
    likes: 89,
    time: '3 hours ago',
    pinned: true,
    tags: ['methodology', 'web-pentest', 'OWASP'],
    preview: 'I\'ve been following the OWASP Testing Guide and PTES, but looking for a more modern approach. What frameworks/checklists do you use for thorough web app testing?',
  },
  {
    id: 2,
    title: 'HTB Seasonal CTF Challenge: "Phantom Gate" Write-up (No spoilers first)',
    author: 'ctf_queen',
    avatar: '🟣',
    category: 'CTF Write-ups',
    replies: 31,
    views: 923,
    likes: 67,
    time: '6 hours ago',
    pinned: false,
    tags: ['HackTheBox', 'CTF', 'write-up'],
    preview: 'Just finished the Phantom Gate challenge. Here\'s my approach without spoiling the key steps. The challenge involved binary exploitation with a twist...',
  },
  {
    id: 3,
    title: 'How to transition from SOC Analyst to Penetration Tester?',
    author: 'blue_to_red',
    avatar: '🔵',
    category: 'Career',
    replies: 56,
    views: 2341,
    likes: 124,
    time: '12 hours ago',
    pinned: false,
    tags: ['career', 'SOC', 'pentest', 'transition'],
    preview: 'I\'ve been a SOC Analyst for 3 years and want to move into offensive security. What certifications, skills, and experience should I focus on?',
  },
  {
    id: 4,
    title: 'Automating Nmap scans with custom NSE scripts - Complete guide',
    author: 'nmap_ninja',
    avatar: '🟢',
    category: 'Tools & Techniques',
    replies: 28,
    views: 1560,
    likes: 95,
    time: '1 day ago',
    pinned: false,
    tags: ['Nmap', 'NSE', 'automation', 'Lua'],
    preview: 'Comprehensive guide on writing and deploying custom Nmap Scripting Engine (NSE) scripts for targeted vulnerability detection.',
  },
  {
    id: 5,
    title: 'Bug Bounty: How I found an IDOR that led to full account takeover',
    author: 'bounty_hunter_x',
    avatar: '🟡',
    category: 'Bug Bounty',
    replies: 73,
    views: 3102,
    likes: 218,
    time: '1 day ago',
    pinned: false,
    tags: ['bug-bounty', 'IDOR', 'account-takeover', 'HackerOne'],
    preview: 'Found an IDOR vulnerability during a private program that allowed me to access any user account. Here\'s the methodology and how I escalated the impact...',
  },
  {
    id: 6,
    title: 'Discussion: Impact of AI on cybersecurity jobs',
    author: 'future_sec',
    avatar: '⚪',
    category: 'General',
    replies: 94,
    views: 4521,
    likes: 156,
    time: '2 days ago',
    pinned: false,
    tags: ['AI', 'career', 'future', 'automation'],
    preview: 'With AI tools becoming more capable at vulnerability detection and even exploitation, how do you see the future of cybersecurity jobs?',
  },
  {
    id: 7,
    title: 'Critical VPN zero-day: Are your clients affected?',
    author: 'sec_news_daily',
    avatar: '🔶',
    category: 'News Discussion',
    replies: 38,
    views: 2890,
    likes: 67,
    time: '2 days ago',
    pinned: false,
    tags: ['zero-day', 'VPN', 'news', 'patch'],
    preview: 'The recently disclosed zero-day affecting multiple enterprise VPN products is being actively exploited. Let\'s discuss mitigation strategies.',
  },
  {
    id: 8,
    title: 'My OSCP journey: From zero to hero in 6 months',
    author: 'oscp_warrior',
    avatar: '🏆',
    category: 'Career',
    replies: 112,
    views: 5670,
    likes: 328,
    time: '3 days ago',
    pinned: false,
    tags: ['OSCP', 'certification', 'study-plan', 'experience'],
    preview: 'After 6 months of intense preparation, I passed the OSCP on my first attempt. Here\'s my complete study plan, resources used, and exam tips.',
  },
];

const COMMUNITY_STATS = [
  { label: 'Members', value: '12,847' },
  { label: 'Discussions', value: '3,421' },
  { label: 'Solutions', value: '8,956' },
  { label: 'Online Now', value: '234' },
];

const LEADERBOARD = [
  { rank: 1, name: 'bounty_hunter_x', points: 12450, badge: '🏆', contributions: 342 },
  { rank: 2, name: 'ctf_queen', points: 11200, badge: '🥈', contributions: 298 },
  { rank: 3, name: 'nmap_ninja', points: 10100, badge: '🥉', contributions: 267 },
  { rank: 4, name: 'pen_tester_pro', points: 9800, badge: '⭐', contributions: 234 },
  { rank: 5, name: 'oscp_warrior', points: 8900, badge: '⭐', contributions: 201 },
];

export default function CommunityPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('community.title', 'Community')} — CyberSec Pro`);
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discussions' | 'leaderboard'>('discussions');
  const [selectedPost, setSelectedPost] = useState<typeof FORUM_POSTS[0] | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);

  const filteredPosts = useMemo(() => {
    return FORUM_POSTS.filter(post => {
      const matchCategory = activeCategory === 'All' || post.category === activeCategory;
      const matchSearch = !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    }).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [activeCategory, searchQuery]);

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white">{t('community.title', 'Community')}</h1>
                <p className="text-gray-400 text-sm">{t('community.subtitle', 'Connect, share knowledge, and grow with fellow security professionals')}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {COMMUNITY_STATS.map(stat => (
            <div key={stat.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900/50 p-1 rounded-xl border border-gray-800 w-fit">
          <button
            onClick={() => setActiveTab('discussions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'discussions' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            💬 Discussions
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'leaderboard' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            🏆 Leaderboard
          </button>
        </div>

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
                    placeholder={t('community.searchPlaceholder', 'Search discussions, tags...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <button onClick={() => setShowNewPost(true)} className="px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-sm text-purple-400 font-medium transition-colors whitespace-nowrap">
                + New Discussion
              </button>
            </div>

            {/* Category Filter */}
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
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Posts List */}
            <div className="space-y-3">
              {filteredPosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPost(post)} className={`bg-gray-900/50 border rounded-xl p-5 hover:border-gray-700 transition-colors cursor-pointer ${post.pinned ? 'border-purple-500/30' : 'border-gray-800'}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-lg flex-shrink-0">
                      {post.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {post.pinned && <span className="text-xs text-purple-400 font-bold">📌 PINNED</span>}
                        <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">{post.category}</span>
                      </div>
                      <h3 className="text-white font-medium mb-1">{post.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-1 mb-2">{post.preview}</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {post.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-800/50 rounded text-[11px] text-gray-500 border border-gray-700/50">#{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>by <span className="text-gray-300">{post.author}</span></span>
                        <span>{post.time}</span>
                        <span>💬 {post.replies}</span>
                        <span>👁 {post.views.toLocaleString()}</span>
                        <span>❤️ {post.likes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* Your Rank */}
            <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xl font-bold text-white">
                  {user?.first_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'You'}</p>
                    <p className="text-gray-400 text-sm">{t('community.yourRankInfo', 'Rank #47 · 2,340 points · 28 contributions')}</p>
                </div>
                <div className="text-right">
                  <p className="text-cyan-400 font-bold text-lg">2,340</p>
                    <p className="text-gray-500 text-xs">{t('community.points', 'points')}</p>
                </div>
              </div>
            </div>

            {/* Top Contributors */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-white">{t('community.topContributors', 'Top Contributors')}</h3>
              </div>
              <div className="divide-y divide-gray-800/50">
                {LEADERBOARD.map(user => (
                  <div key={user.rank} className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors">
                    <span className="text-lg w-8 text-center">{user.badge}</span>
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                      #{user.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{user.name}</p>
                      <p className="text-gray-500 text-xs">{user.contributions} contributions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 font-bold">{user.points.toLocaleString()}</p>
                      <p className="text-gray-600 text-xs">{t('community.points', 'points')}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                <button onClick={() => setSelectedPost(null)} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
              </div>

              <h2 className="text-xl font-bold text-white mb-3">{selectedPost.title}</h2>

              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800">
                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm">{selectedPost.avatar}</div>
                <span className="text-gray-300 text-sm font-medium">{selectedPost.author}</span>
                <span className="text-gray-600 text-sm">·</span>
                <span className="text-gray-500 text-sm">{selectedPost.time}</span>
              </div>

              <p className="text-gray-300 leading-relaxed mb-4">{selectedPost.preview}</p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedPost.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 border border-gray-700">#{tag}</span>
                ))}
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-500 mb-6 pb-4 border-b border-gray-800">
                <span>💬 {selectedPost.replies} replies</span>
                <span>👁 {selectedPost.views.toLocaleString()} views</span>
                <span>❤️ {selectedPost.likes} likes</span>
              </div>

              <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-4 mb-4">
                <p className="text-gray-500 text-sm text-center">{t('community.discussionThreadsNote', 'Discussion threads are available in the full community portal.')}</p>
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
                  <button onClick={() => setShowNewPost(false)} aria-label={t('common.close', 'Close')} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('community.form.titleLabel', 'Title')}</label>
                    <input type="text" placeholder={t('community.form.titlePlaceholder', "What's on your mind?")} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('community.form.categoryLabel', 'Category')}</label>
                  <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    {FORUM_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('community.form.contentLabel', 'Content')}</label>
                    <textarea rows={4} placeholder={t('community.form.contentPlaceholder', 'Share your thoughts, questions, or findings...')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowNewPost(false)} className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all text-sm">
                    Post Discussion
                  </button>
                  <button onClick={() => setShowNewPost(false)} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors text-sm">
                    Cancel
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
