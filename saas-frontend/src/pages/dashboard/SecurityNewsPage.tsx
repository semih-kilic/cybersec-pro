import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

const NEWS_CATEGORIES = ['All', 'Breaches', 'Vulnerabilities', 'Malware', 'Policy', 'Research', 'Tools'] as const;

function hoursAgo(h: number): string {
  if (h < 1) return 'Just now';
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

const SECURITY_NEWS = [
  {
    id: 1,
    title: 'Critical Zero-Day in Palo Alto PAN-OS Actively Exploited (CVE-2026-0078)',
    summary: 'CISA has added CVE-2026-0078 to the Known Exploited Vulnerabilities catalog. A critical RCE in PAN-OS GlobalProtect gateway is being exploited by UNC5325. Palo Alto Networks released an emergency patch — update immediately.',
    category: 'Vulnerabilities',
    source: 'BleepingComputer',
    author: 'Lawrence Abrams',
    time: hoursAgo(2),
    readTime: '4 min',
    tags: ['zero-day', 'PAN-OS', 'CVE-2026-0078', 'CISA'],
    featured: true,
  },
  {
    id: 2,
    title: 'Major Healthcare Provider Confirms Data Breach Affecting 6.2M Patients',
    summary: 'Ascension Health disclosed a ransomware incident exposing personal health information of 6.2 million patients. The attack, attributed to the Scattered Spider group, exploited a Citrix NetScaler vulnerability.',
    category: 'Breaches',
    source: 'The Record',
    author: 'Jonathan Greig',
    time: hoursAgo(5),
    readTime: '6 min',
    tags: ['healthcare', 'ransomware', 'HIPAA', 'Scattered Spider'],
    featured: true,
  },
  {
    id: 3,
    title: 'New AI-Generated Deepfake Phishing Campaign Bypasses MFA',
    summary: 'Microsoft Threat Intelligence reports a sophisticated phishing operation using AI-generated voice and video deepfakes to bypass multi-factor authentication. Targets include C-level executives at Fortune 500 companies.',
    category: 'Malware',
    source: 'Dark Reading',
    author: 'Jai Vijayan',
    time: hoursAgo(8),
    readTime: '5 min',
    tags: ['deepfake', 'AI', 'MFA bypass', 'phishing'],
    featured: false,
  },
  {
    id: 4,
    title: 'EU Cyber Resilience Act Enforcement Begins — Fines Up to €15M',
    summary: 'The European Union has begun enforcing the Cyber Resilience Act. Software vendors selling products in the EU now face fines up to €15M or 2.5% of global revenue for non-compliance with mandatory vulnerability disclosure and security updates.',
    category: 'Policy',
    source: 'CSO Online',
    author: 'Michael Hill',
    time: hoursAgo(12),
    readTime: '7 min',
    tags: ['EU', 'CRA', 'compliance', 'regulation'],
    featured: false,
  },
  {
    id: 5,
    title: 'Kali Linux 2026.2 Released with AI-Powered Recon and 18 New Tools',
    summary: 'OffSec has released Kali Linux 2026.2, featuring AI-assisted reconnaissance, 18 new tools including CloudBrute v2 and API-Fuzzer Pro, and native Apple Silicon M4 support with improved Wi-Fi 7 injection capabilities.',
    category: 'Tools',
    source: 'Kali.org',
    author: 'Kali Team',
    time: hoursAgo(24),
    readTime: '3 min',
    tags: ['Kali Linux', '2026.2', 'tools', 'AI recon'],
    featured: false,
  },
  {
    id: 6,
    title: 'Volt Typhoon Deploys Novel Firmware Implant in Telecom Infrastructure',
    summary: 'CISA and FBI joint advisory warns that Volt Typhoon (China-linked APT) has deployed a previously unknown firmware implant in edge network devices at major US telecommunications providers, enabling persistent access.',
    category: 'Malware',
    source: 'Microsoft Security Blog',
    author: 'MSTIC',
    time: hoursAgo(30),
    readTime: '8 min',
    tags: ['Volt Typhoon', 'APT', 'firmware', 'telecom'],
    featured: false,
  },
  {
    id: 7,
    title: 'NIST Releases Post-Quantum Cryptography Migration Guide',
    summary: 'NIST has published the final Post-Quantum Cryptography (PQC) Migration Guide (SP 800-227), providing organizations with step-by-step instructions for transitioning from RSA/ECC to CRYSTALS-Kyber and CRYSTALS-Dilithium algorithms.',
    category: 'Policy',
    source: 'NIST',
    author: 'NIST CSRC',
    time: hoursAgo(48),
    readTime: '5 min',
    tags: ['NIST', 'post-quantum', 'cryptography', 'PQC'],
    featured: false,
  },
  {
    id: 8,
    title: 'Study: 73% of LLM-Generated Code Contains At Least One CWE Weakness',
    summary: 'A Stanford & Google DeepMind study analyzing code from 15 major LLMs found that 73% of AI-generated code snippets contain at least one Common Weakness Enumeration (CWE) vulnerability, with CWE-79 (XSS) and CWE-89 (SQLi) most prevalent.',
    category: 'Research',
    source: 'ACM Research',
    author: 'Dr. Sarah Chen et al.',
    time: hoursAgo(56),
    readTime: '10 min',
    tags: ['LLM security', 'AI code', 'CWE', 'research'],
    featured: false,
  },
  {
    id: 9,
    title: 'Raptor Botnet: 500K Compromised IoT Devices Targeting Power Grid OT Systems',
    summary: 'Dragos researchers uncovered "Raptor," a massive botnet of 500K+ compromised IoT devices specifically targeting Operational Technology (OT) systems in the energy sector via Modbus/TCP and IEC 61850 protocols.',
    category: 'Malware',
    source: 'Ars Technica',
    author: 'Dan Goodin',
    time: hoursAgo(72),
    readTime: '6 min',
    tags: ['botnet', 'IoT', 'OT security', 'power grid'],
    featured: false,
  },
  {
    id: 10,
    title: 'GitHub Enforces Artifact Attestation for All Public Packages',
    summary: 'GitHub now requires SLSA Build Level 3 artifact attestation for all public npm, PyPI, and container packages published through GitHub Actions, following a wave of supply chain attacks in Q1 2026.',
    category: 'Policy',
    source: 'GitHub Blog',
    author: 'Mike Hanley',
    time: hoursAgo(80),
    readTime: '3 min',
    tags: ['GitHub', 'SLSA', 'supply chain', 'attestation'],
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
  const { t } = useTranslation();
  useDocumentTitle(`${t('securityNews.title', 'Security News')} — CyberSec Pro`);
  const { t: _t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNews, setSelectedNews] = useState<typeof SECURITY_NEWS[0] | null>(null);

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
              <h1 className="text-2xl font-bold text-white">{t('securityNews.title', 'Security News Feed')}</h1>
              <p className="text-gray-400 text-sm">{t('securityNews.subtitle', 'Latest cybersecurity news, breaches, and industry updates')}</p>
            </div>
          </div>
        </div>

        {/* Featured News */}
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
              placeholder={t('securityNews.searchPlaceholder', 'Search news, topics, tags...')}
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
            <div key={news.id} onClick={() => setSelectedNews(news)} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors cursor-pointer">
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
            <p className="text-gray-500">{t('securityNews.noArticles', 'No news articles match your criteria.')}</p>
          </div>
        )}

        {/* News Detail Modal */}
        {selectedNews && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedNews(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(selectedNews.category)}`}>
                    {selectedNews.category}
                  </span>
                  <span className="text-gray-500 text-xs">{selectedNews.time}</span>
                </div>
                <button onClick={() => setSelectedNews(null)} className="text-gray-400 hover:text-white transition-colors text-xl">{t('common.close', '✕')}</button>
              </div>

              <h2 className="text-xl font-bold text-white mb-3">{selectedNews.title}</h2>

              <div className="flex items-center gap-3 text-xs text-gray-500 mb-4 pb-4 border-b border-gray-800">
                <span className="font-medium text-gray-400">{selectedNews.source}</span>
                <span>·</span>
                <span>By {selectedNews.author}</span>
                <span>·</span>
                <span>{selectedNews.readTime} read</span>
              </div>

              <div className="text-gray-300 leading-relaxed space-y-4 mb-6">
                <p>{selectedNews.summary}</p>
                <p className="text-gray-400">This article is sourced from {selectedNews.source}. For the full report, visit the original publication. CyberSec Pro aggregates security news from trusted sources to keep you informed about the latest threats and developments.</p>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-6">
                {selectedNews.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 border border-gray-700">#{tag}</span>
                ))}
              </div>

              <button
                onClick={() => setSelectedNews(null)}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
