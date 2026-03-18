import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

const NEWS_CATEGORIES = ['All', 'Breaches', 'Vulnerabilities', 'Malware', 'Policy', 'Research', 'Tools'] as const;

const SECURITY_NEWS = [
  {
    id: 1,
    title: 'Critical Zero-Day in Popular Enterprise VPN Actively Exploited',
    summary: 'Security researchers have discovered a critical zero-day vulnerability in a widely-used enterprise VPN solution that is being actively exploited by state-sponsored threat actors. Organizations are urged to apply the emergency patch immediately.',
    category: 'Vulnerabilities',
    source: 'BleepingComputer',
    author: 'Lawrence Abrams',
    time: '2 hours ago',
    readTime: '4 min',
    tags: ['zero-day', 'VPN', 'APT', 'patch'],
    featured: true,
  },
  {
    id: 2,
    title: 'Major Healthcare Provider Confirms Data Breach Affecting 4.5M Patients',
    summary: 'A leading healthcare organization disclosed a data breach that exposed personal health information of 4.5 million patients. The breach was caused by a ransomware attack attributed to the BlackCat/ALPHV group.',
    category: 'Breaches',
    source: 'The Record',
    author: 'Jonathan Greig',
    time: '5 hours ago',
    readTime: '6 min',
    tags: ['healthcare', 'ransomware', 'HIPAA', 'breach'],
    featured: true,
  },
  {
    id: 3,
    title: 'New AI-Powered Phishing Campaign Bypasses Email Security Filters',
    summary: 'Researchers identify a sophisticated phishing operation using AI-generated content to bypass traditional email security gateways. The campaign targets financial institutions across 30 countries.',
    category: 'Malware',
    source: 'Dark Reading',
    author: 'Jai Vijayan',
    time: '8 hours ago',
    readTime: '5 min',
    tags: ['phishing', 'AI', 'email security', 'financial'],
    featured: false,
  },
  {
    id: 4,
    title: 'EU Cyber Resilience Act: What It Means for Software Vendors',
    summary: 'The European Union has finalized the Cyber Resilience Act, imposing strict cybersecurity requirements on all software products sold in the EU. Companies have 36 months to comply with the new regulations.',
    category: 'Policy',
    source: 'CSO Online',
    author: 'Michael Hill',
    time: '12 hours ago',
    readTime: '7 min',
    tags: ['EU', 'regulation', 'compliance', 'CRA'],
    featured: false,
  },
  {
    id: 5,
    title: 'Kali Linux 2025.1 Released with 15 New Security Tools',
    summary: 'Offensive Security has released Kali Linux 2025.1, featuring 15 new penetration testing tools, updated kernel, and improved hardware support for wireless testing. Notable additions include advanced cloud security testing tools.',
    category: 'Tools',
    source: 'Kali.org',
    author: 'Kali Team',
    time: '1 day ago',
    readTime: '3 min',
    tags: ['Kali Linux', 'tools', 'release', 'pentest'],
    featured: false,
  },
  {
    id: 6,
    title: 'Russian APT Group Deploys New Backdoor in Supply Chain Attack',
    summary: 'Microsoft Threat Intelligence reveals a new supply chain attack by a Russian APT group targeting IT managed service providers. A novel backdoor dubbed "SilentGate" was discovered in a compromised software update mechanism.',
    category: 'Malware',
    source: 'Microsoft Security Blog',
    author: 'MSTIC',
    time: '1 day ago',
    readTime: '8 min',
    tags: ['APT', 'supply chain', 'Russia', 'backdoor'],
    featured: false,
  },
  {
    id: 7,
    title: 'NIST Releases Updated Cybersecurity Framework 2.1 Guidelines',
    summary: 'NIST has published version 2.1 of the Cybersecurity Framework, adding new guidance on AI security, supply chain risk management, and zero-trust architecture implementation.',
    category: 'Policy',
    source: 'NIST',
    author: 'NIST CSRC',
    time: '2 days ago',
    readTime: '5 min',
    tags: ['NIST', 'framework', 'CSF', 'guidelines'],
    featured: false,
  },
  {
    id: 8,
    title: 'Researchers Discover Memory-Safe Languages Still Vulnerable to Logic Bugs',
    summary: 'A comprehensive study across 10,000 open-source projects shows that while memory-safe languages eliminate buffer overflows, logic vulnerabilities and misconfigurations remain prevalent.',
    category: 'Research',
    source: 'ACM Research',
    author: 'Dr. Sarah Chen et al.',
    time: '2 days ago',
    readTime: '10 min',
    tags: ['research', 'Rust', 'Go', 'memory safety'],
    featured: false,
  },
  {
    id: 9,
    title: 'Massive Botnet Leveraging IoT Devices for DDoS Attacks on Critical Infrastructure',
    summary: 'A newly discovered botnet comprising over 300,000 compromised IoT devices has been linked to DDoS attacks against critical infrastructure including power grids and water treatment facilities.',
    category: 'Malware',
    source: 'Ars Technica',
    author: 'Dan Goodin',
    time: '3 days ago',
    readTime: '6 min',
    tags: ['botnet', 'IoT', 'DDoS', 'infrastructure'],
    featured: false,
  },
  {
    id: 10,
    title: 'GitHub Announces Mandatory 2FA for All Organization Members',
    summary: 'GitHub will require all members of GitHub organizations to enable two-factor authentication by Q2 2025, following a series of supply chain attacks targeting developer accounts.',
    category: 'Policy',
    source: 'GitHub Blog',
    author: 'Mike Hanley',
    time: '3 days ago',
    readTime: '3 min',
    tags: ['GitHub', '2FA', 'supply chain', 'authentication'],
    featured: false,
  },
];

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

export default function SecurityNewsPage() {
  useDocumentTitle('Security News — CyberSec Pro');
  const { t: _t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNews = useMemo(() => {
    return SECURITY_NEWS.filter(news => {
      const matchCategory = activeCategory === 'All' || news.category === activeCategory;
      const matchSearch = !searchQuery ||
        news.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        news.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        news.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const featuredNews = SECURITY_NEWS.filter(n => n.featured);

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Security News Feed</h1>
              <p className="text-gray-400 text-sm">Latest cybersecurity news, breaches, and industry updates</p>
            </div>
          </div>
        </div>

        {/* Featured News */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {featuredNews.map(news => (
            <div key={news.id} className="relative bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/30 transition-colors group">
              <div className="absolute top-4 right-4">
                <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-[10px] font-bold text-cyan-400 uppercase">Featured</span>
              </div>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(news.category)} mb-3`}>
                {news.category}
              </span>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">{news.title}</h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{news.summary}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{news.source}</span>
                <span>·</span>
                <span>{news.time}</span>
                <span>·</span>
                <span>{news.readTime} read</span>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Category Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search news, topics, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {NEWS_CATEGORIES.map(cat => (
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

        {/* News List */}
        <div className="space-y-3">
          {filteredNews.map(news => (
            <div key={news.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(news.category)}`}>
                      {news.category}
                    </span>
                    <span className="text-gray-600 text-xs">{news.time}</span>
                  </div>
                  <h3 className="text-white font-medium mb-1">{news.title}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-2">{news.summary}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{news.source} · {news.author}</span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-500">{news.readTime} read</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {news.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-800 rounded text-[11px] text-gray-500 border border-gray-700/50">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredNews.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No news articles match your criteria.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
