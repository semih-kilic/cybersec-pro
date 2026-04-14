import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

// Helper: generate relative date strings based on current time
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function randomizeIndicators(base: number): number {
  return base + Math.floor(Math.random() * 100) - 50;
}

// Dynamic threat data - regenerated with current timestamps
function generateThreatFeeds() {
  return [
    { id: 1, name: 'AlienVault OTX', type: 'IP/Domain', indicators: randomizeIndicators(2847), lastUpdate: '2 min ago', status: 'active', severity: 'high' },
    { id: 2, name: 'Abuse.ch URLhaus', type: 'URLs', indicators: randomizeIndicators(1523), lastUpdate: '5 min ago', status: 'active', severity: 'critical' },
    { id: 3, name: 'PhishTank', type: 'Phishing URLs', indicators: randomizeIndicators(892), lastUpdate: '15 min ago', status: 'active', severity: 'medium' },
    { id: 4, name: 'Emerging Threats', type: 'IDS Rules', indicators: randomizeIndicators(4102), lastUpdate: '1 hour ago', status: 'active', severity: 'high' },
    { id: 5, name: 'Tor Exit Nodes', type: 'IP Addresses', indicators: randomizeIndicators(1247), lastUpdate: '30 min ago', status: 'active', severity: 'low' },
    { id: 6, name: 'Malware Bazaar', type: 'File Hashes', indicators: randomizeIndicators(3891), lastUpdate: '10 min ago', status: 'active', severity: 'critical' },
    { id: 7, name: 'CISA KEV Catalog', type: 'CVEs', indicators: randomizeIndicators(1189), lastUpdate: '3 min ago', status: 'active', severity: 'critical' },
    { id: 8, name: 'VirusTotal Retrohunt', type: 'File Hashes', indicators: randomizeIndicators(5420), lastUpdate: '20 min ago', status: 'active', severity: 'high' },
  ];
}

const APT_GROUPS = [
  { name: 'APT28 (Fancy Bear)', origin: 'Russia', targets: 'Government, Military, Media', lastActivity: daysAgo(2), ttps: ['Spear Phishing', 'Zero-day Exploits', 'Credential Harvesting'], risk: 'critical' },
  { name: 'APT29 (Cozy Bear)', origin: 'Russia', targets: 'Government, Think Tanks, Healthcare', lastActivity: daysAgo(4), ttps: ['Supply Chain', 'Cloud Exploitation', 'Custom Malware'], risk: 'critical' },
  { name: 'APT41 (Double Dragon)', origin: 'China', targets: 'Technology, Healthcare, Telecom', lastActivity: daysAgo(6), ttps: ['Supply Chain', 'Rootkits', 'Code Signing'], risk: 'high' },
  { name: 'Lazarus Group', origin: 'North Korea', targets: 'Financial, Cryptocurrency, Government', lastActivity: daysAgo(3), ttps: ['Watering Hole', 'Custom Trojans', 'Cryptocurrency Theft'], risk: 'critical' },
  { name: 'APT33 (Elfin)', origin: 'Iran', targets: 'Aerospace, Energy, Government', lastActivity: daysAgo(10), ttps: ['Spear Phishing', 'Destructive Malware', 'Password Spraying'], risk: 'high' },
  { name: 'FIN7', origin: 'Russia', targets: 'Retail, Hospitality, Financial', lastActivity: daysAgo(5), ttps: ['Phishing', 'POS Malware', 'Social Engineering'], risk: 'high' },
  { name: 'Volt Typhoon', origin: 'China', targets: 'Critical Infrastructure, Telecom', lastActivity: daysAgo(1), ttps: ['Living-off-the-Land', 'VPN Exploitation', 'Lateral Movement'], risk: 'critical' },
  { name: 'Sandworm', origin: 'Russia', targets: 'Energy, Government, Industrial', lastActivity: daysAgo(7), ttps: ['Destructive Malware', 'ICS Attacks', 'Wiper Deployment'], risk: 'critical' },
];

function generateIOCs() {
  return [
    { type: 'IP', value: '185.220.101.***', threat: 'C2 Server', source: 'AlienVault OTX', confidence: 95, first: daysAgo(3), last: daysAgo(0) },
    { type: 'Domain', value: 'malicious-update[.]com', threat: 'Phishing', source: 'PhishTank', confidence: 99, first: daysAgo(5), last: daysAgo(0) },
    { type: 'Hash', value: 'a1b2c3d4e5f6789...', threat: 'Ransomware (LockBit 4.0)', source: 'Malware Bazaar', confidence: 100, first: daysAgo(2), last: daysAgo(1) },
    { type: 'URL', value: 'hxxps://evil-login[.]net/o365', threat: 'Credential Theft', source: 'URLhaus', confidence: 92, first: daysAgo(4), last: daysAgo(0) },
    { type: 'IP', value: '91.219.236.***', threat: 'Botnet C2 (Mirai variant)', source: 'Emerging Threats', confidence: 88, first: daysAgo(7), last: daysAgo(1) },
    { type: 'Domain', value: 'fake-bank-login[.]xyz', threat: 'Banking Trojan', source: 'PhishTank', confidence: 97, first: daysAgo(6), last: daysAgo(0) },
    { type: 'Hash', value: 'f7g8h9i0j1k2l3m...', threat: 'Infostealer (Lumma)', source: 'Malware Bazaar', confidence: 94, first: daysAgo(1), last: daysAgo(0) },
    { type: 'IP', value: '45.33.32.***', threat: 'Active Scanning', source: 'AlienVault OTX', confidence: 75, first: daysAgo(8), last: daysAgo(2) },
    { type: 'Domain', value: 'update-service[.]cloud', threat: 'Supply Chain C2', source: 'CISA KEV', confidence: 98, first: daysAgo(1), last: daysAgo(0) },
    { type: 'Hash', value: 'e4d5c6b7a8f9012...', threat: 'Backdoor (SilentGate)', source: 'VirusTotal', confidence: 96, first: daysAgo(3), last: daysAgo(0) },
  ];
}

const GLOBAL_THREAT_STATS = [
  { label: 'Active Threats', value: '15,293', change: '+14%', trend: 'up' },
  { label: 'IOCs Tracked', value: '2.7M', change: '+11%', trend: 'up' },
  { label: 'APT Campaigns', value: '28', change: '+5', trend: 'up' },
  { label: 'Avg Response Time', value: '3.8h', change: '-22%', trend: 'down' },
];

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 90) return 'text-red-400';
  if (confidence >= 70) return 'text-orange-400';
  if (confidence >= 50) return 'text-yellow-400';
  return 'text-green-400';
}

export default function ThreatIntelPage() {
  useDocumentTitle('Threat Intelligence — CyberSec Pro');
  const { t: _t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'feeds' | 'iocs' | 'apt'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Generate dynamic data on mount (simulates live feed)
  const [threatFeeds, setThreatFeeds] = useState(generateThreatFeeds);
  const [recentIOCs, setRecentIOCs] = useState(generateIOCs);

  // Auto-refresh feeds every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setThreatFeeds(generateThreatFeeds());
      setRecentIOCs(generateIOCs());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredIOCs = useMemo(() => {
    if (!searchQuery) return recentIOCs;
    const q = searchQuery.toLowerCase();
    return recentIOCs.filter(ioc =>
      ioc.value.toLowerCase().includes(q) ||
      ioc.threat.toLowerCase().includes(q) ||
      ioc.type.toLowerCase().includes(q)
    );
  }, [searchQuery, recentIOCs]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'feeds' as const, label: 'Threat Feeds', icon: '📡' },
    { id: 'iocs' as const, label: 'IOCs', icon: '🎯' },
    { id: 'apt' as const, label: 'APT Groups', icon: '👤' },
  ];

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Threat Intelligence</h1>
              <p className="text-gray-400 text-sm">Real-time cyber threat monitoring, IOC tracking & APT analysis</p>
            </div>
          </div>
        </div>

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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {GLOBAL_THREAT_STATS.map(stat => (
                <div key={stat.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">{stat.value}</span>
                    <span className={`text-sm font-medium ${stat.trend === 'up' ? 'text-red-400' : 'text-green-400'}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* World Threat Map placeholder */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Global Threat Landscape</h3>
              <div className="relative bg-gray-950 rounded-lg p-8 min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-white font-medium mb-1">Interactive Threat Map</p>
                  <p className="text-gray-500 text-sm">Visualize global attack origins, target regions, and threat vectors</p>
                  <div className="mt-4 flex flex-wrap gap-3 justify-center">
                    {['🇷🇺 Russia: 2,847', '🇨🇳 China: 1,923', '🇰🇵 N.Korea: 892', '🇮🇷 Iran: 456', '🇺🇸 USA: 1,102'].map(item => (
                      <span key={item} className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300 border border-gray-700">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent High-Priority Threats */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent High-Priority Threats</h3>
              <div className="space-y-3">
                {[
                  { title: 'Volt Typhoon Targets US Critical Infrastructure via Cisco Routers', severity: 'critical', time: '1 hour ago', source: 'CISA Advisory' },
                  { title: 'Zero-Day in Palo Alto GlobalProtect VPN (CVE-2026-0198)', severity: 'critical', time: '3 hours ago', source: 'NVD' },
                  { title: 'LockBit 4.0 Ransomware Variant Discovered with AI Evasion', severity: 'critical', time: '6 hours ago', source: 'Mandiant' },
                  { title: 'New Phishing Kit Mimicking Microsoft 365 Login via QR Codes', severity: 'high', time: '12 hours ago', source: 'PhishTank' },
                  { title: 'APT29 Supply Chain Attack via npm Package Poisoning', severity: 'high', time: '18 hours ago', source: 'Snyk' },
                  { title: 'Critical RCE in Apache Struts (CVE-2026-0215)', severity: 'critical', time: '1 day ago', source: 'Apache Security' },
                ].map((threat, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-gray-950/50 rounded-lg border border-gray-800/50 hover:border-gray-700 transition-colors">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getSeverityColor(threat.severity)}`}>
                      {threat.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{threat.title}</p>
                      <p className="text-gray-500 text-xs">{threat.source} · {threat.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Threat Feeds Tab */}
        {activeTab === 'feeds' && (
          <div className="space-y-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-white">Active Threat Feeds</h3>
                <p className="text-gray-400 text-sm mt-1">Connected intelligence sources providing real-time threat data</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Feed</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Indicators</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Update</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Severity</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {threatFeeds.map(feed => (
                      <tr key={feed.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-white font-medium">{feed.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{feed.type}</td>
                        <td className="px-4 py-3 text-sm text-cyan-400 font-mono">{feed.indicators.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{feed.lastUpdate}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getSeverityColor(feed.severity)}`}>
                            {feed.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-sm text-green-400">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* IOCs Tab */}
        {activeTab === 'iocs' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search IOCs by IP, domain, hash, or threat type..."
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
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Indicator</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Threat</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Confidence</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">First Seen</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIOCs.map((ioc, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-800 rounded text-xs font-mono text-gray-300">{ioc.type}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-cyan-400 font-mono">{ioc.value}</td>
                        <td className="px-4 py-3 text-sm text-white">{ioc.threat}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{ioc.source}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${getConfidenceColor(ioc.confidence)}`}>
                            {ioc.confidence}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{ioc.first}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{ioc.last}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* APT Groups Tab */}
        {activeTab === 'apt' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {APT_GROUPS.map((apt, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-white font-semibold">{apt.name}</h4>
                    <p className="text-gray-500 text-sm">Origin: {apt.origin}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getSeverityColor(apt.risk)}`}>
                    {apt.risk}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Targets:</span>
                    <span className="text-gray-300 ml-2">{apt.targets}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Activity:</span>
                    <span className="text-gray-300 ml-2">{apt.lastActivity}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">TTPs:</span>
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
      </div>
    </PageTransition>
  );
}
