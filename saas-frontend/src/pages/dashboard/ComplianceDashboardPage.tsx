import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

const FRAMEWORKS = [
  {
    id: 'nist',
    name: 'NIST CSF 2.0',
    fullName: 'National Institute of Standards and Technology Cybersecurity Framework',
    version: '2.0',
    categories: [
      { name: 'Govern', controls: 6, compliant: 4, partial: 1, nonCompliant: 1 },
      { name: 'Identify', controls: 12, compliant: 8, partial: 3, nonCompliant: 1 },
      { name: 'Protect', controls: 15, compliant: 11, partial: 2, nonCompliant: 2 },
      { name: 'Detect', controls: 8, compliant: 6, partial: 1, nonCompliant: 1 },
      { name: 'Respond', controls: 10, compliant: 7, partial: 2, nonCompliant: 1 },
      { name: 'Recover', controls: 6, compliant: 3, partial: 2, nonCompliant: 1 },
    ],
    overallScore: 78,
    color: 'blue',
  },
  {
    id: 'owasp',
    name: 'OWASP Top 10',
    fullName: 'Open Web Application Security Project Top 10 (2021)',
    version: '2021',
    categories: [
      { name: 'Broken Access Control', controls: 5, compliant: 4, partial: 1, nonCompliant: 0 },
      { name: 'Cryptographic Failures', controls: 4, compliant: 3, partial: 1, nonCompliant: 0 },
      { name: 'Injection', controls: 4, compliant: 4, partial: 0, nonCompliant: 0 },
      { name: 'Insecure Design', controls: 6, compliant: 4, partial: 1, nonCompliant: 1 },
      { name: 'Security Misconfiguration', controls: 5, compliant: 3, partial: 2, nonCompliant: 0 },
      { name: 'Vulnerable Components', controls: 3, compliant: 2, partial: 1, nonCompliant: 0 },
      { name: 'Auth Failures', controls: 4, compliant: 3, partial: 1, nonCompliant: 0 },
      { name: 'Data Integrity Failures', controls: 3, compliant: 2, partial: 1, nonCompliant: 0 },
      { name: 'Logging Failures', controls: 4, compliant: 3, partial: 0, nonCompliant: 1 },
      { name: 'SSRF', controls: 3, compliant: 3, partial: 0, nonCompliant: 0 },
    ],
    overallScore: 85,
    color: 'emerald',
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    version: '2018',
    categories: [
      { name: 'Lawful Processing', controls: 4, compliant: 3, partial: 1, nonCompliant: 0 },
      { name: 'Data Subject Rights', controls: 8, compliant: 6, partial: 1, nonCompliant: 1 },
      { name: 'Data Protection by Design', controls: 5, compliant: 4, partial: 1, nonCompliant: 0 },
      { name: 'Data Breach Notification', controls: 3, compliant: 2, partial: 1, nonCompliant: 0 },
      { name: 'DPO & Governance', controls: 4, compliant: 3, partial: 0, nonCompliant: 1 },
      { name: 'International Transfers', controls: 3, compliant: 2, partial: 1, nonCompliant: 0 },
    ],
    overallScore: 81,
    color: 'purple',
  },
  {
    id: 'pci',
    name: 'PCI DSS 4.0',
    fullName: 'Payment Card Industry Data Security Standard',
    version: '4.0',
    categories: [
      { name: 'Network Security', controls: 6, compliant: 5, partial: 1, nonCompliant: 0 },
      { name: 'Account Data Protection', controls: 8, compliant: 6, partial: 1, nonCompliant: 1 },
      { name: 'Vulnerability Management', controls: 5, compliant: 4, partial: 1, nonCompliant: 0 },
      { name: 'Access Control', controls: 7, compliant: 5, partial: 1, nonCompliant: 1 },
      { name: 'Monitoring & Testing', controls: 6, compliant: 4, partial: 2, nonCompliant: 0 },
      { name: 'Security Policy', controls: 4, compliant: 3, partial: 1, nonCompliant: 0 },
    ],
    overallScore: 79,
    color: 'orange',
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    fullName: 'Health Insurance Portability and Accountability Act',
    version: '2013',
    categories: [
      { name: 'Administrative Safeguards', controls: 9, compliant: 6, partial: 2, nonCompliant: 1 },
      { name: 'Physical Safeguards', controls: 4, compliant: 3, partial: 1, nonCompliant: 0 },
      { name: 'Technical Safeguards', controls: 5, compliant: 4, partial: 1, nonCompliant: 0 },
      { name: 'Organizational Requirements', controls: 3, compliant: 2, partial: 1, nonCompliant: 0 },
      { name: 'Breach Notification', controls: 3, compliant: 2, partial: 0, nonCompliant: 1 },
    ],
    overallScore: 75,
    color: 'cyan',
  },
  {
    id: 'soc2',
    name: 'SOC 2',
    fullName: 'Service Organization Control 2',
    version: 'Type II',
    categories: [
      { name: 'Security', controls: 12, compliant: 9, partial: 2, nonCompliant: 1 },
      { name: 'Availability', controls: 5, compliant: 4, partial: 1, nonCompliant: 0 },
      { name: 'Processing Integrity', controls: 4, compliant: 3, partial: 1, nonCompliant: 0 },
      { name: 'Confidentiality', controls: 6, compliant: 5, partial: 1, nonCompliant: 0 },
      { name: 'Privacy', controls: 8, compliant: 6, partial: 1, nonCompliant: 1 },
    ],
    overallScore: 82,
    color: 'yellow',
  },
];

function getScoreColor(score: number) {
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
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
  useDocumentTitle(`${t('compliance.title', 'Compliance Dashboard')} — CyberSec Pro`);
  const { t } = useTranslation();
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);

  const selected = FRAMEWORKS.find(f => f.id === selectedFramework);

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('compliance.dashboardTitle', 'Compliance Dashboard')}</h1>
              <p className="text-gray-400 text-sm">{t('compliance.dashboardSubtitle', 'Track compliance across NIST, OWASP, GDPR, PCI DSS, HIPAA & SOC 2 frameworks')}</p>
            </div>
          </div>
        </div>

        {/* Overall Compliance Summary */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-medium text-gray-400 mb-4">{t('compliance.overallPosture', 'Overall Compliance Posture')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {FRAMEWORKS.map(fw => {
              const totalControls = fw.categories.reduce((a, c) => a + c.controls, 0);
              const compliant = fw.categories.reduce((a, c) => a + c.compliant, 0);
              return (
                <button
                  key={fw.id}
                  onClick={() => setSelectedFramework(selectedFramework === fw.id ? null : fw.id)}
                  className={`text-center p-4 rounded-xl border transition-all ${
                    selectedFramework === fw.id
                      ? `bg-gradient-to-br ${getFrameworkColor(fw.color)} ring-1 ring-white/10`
                      : 'bg-gray-950/50 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <p className={`text-2xl font-bold ${getScoreColor(fw.overallScore)}`}>{fw.overallScore}%</p>
                  <p className="text-white text-sm font-medium mt-1">{fw.name}</p>
                  <p className="text-gray-500 text-xs">{compliant}/{totalControls} controls</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Framework Detail */}
        {selected && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{selected.fullName}</h3>
                <p className="text-gray-400 text-sm">Version {selected.version} · {selected.categories.length} categories</p>
              </div>
              <button
                onClick={() => setSelectedFramework(null)}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {selected.categories.map((cat, i) => {
                const pctCompliant = Math.round((cat.compliant / cat.controls) * 100);
                const pctPartial = Math.round((cat.partial / cat.controls) * 100);
                return (
                  <div key={i} className="bg-gray-950/50 rounded-lg p-4 border border-gray-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white text-sm font-medium">{cat.name}</h4>
                      <span className="text-xs text-gray-500">{cat.compliant}/{cat.controls} compliant</span>
                    </div>
                    <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-800">
                      <div className="bg-green-500 transition-all" style={{ width: `${pctCompliant}%` }} />
                      <div className="bg-yellow-500 transition-all" style={{ width: `${pctPartial}%` }} />
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-green-400">✓ {cat.compliant} Compliant</span>
                      <span className="text-yellow-400">◐ {cat.partial} Partial</span>
                      <span className="text-red-400">✕ {cat.nonCompliant} Non-Compliant</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Framework Cards when none selected */}
        {!selected && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {FRAMEWORKS.map(fw => {
              const totalControls = fw.categories.reduce((a, c) => a + c.controls, 0);
              const compliant = fw.categories.reduce((a, c) => a + c.compliant, 0);
              const partial = fw.categories.reduce((a, c) => a + c.partial, 0);
              const nonCompliant = fw.categories.reduce((a, c) => a + c.nonCompliant, 0);
              return (
                <button
                  key={fw.id}
                  onClick={() => setSelectedFramework(fw.id)}
                  className="text-left bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-white font-semibold">{fw.name}</h4>
                      <p className="text-gray-500 text-xs">{fw.fullName}</p>
                    </div>
                    <div className={`text-2xl font-bold ${getScoreColor(fw.overallScore)}`}>{fw.overallScore}%</div>
                  </div>
                  <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-gray-800 mb-3">
                    <div className="bg-green-500" style={{ width: `${(compliant / totalControls) * 100}%` }} />
                    <div className="bg-yellow-500" style={{ width: `${(partial / totalControls) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(nonCompliant / totalControls) * 100}%` }} />
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-400">✓ {compliant}</span>
                    <span className="text-yellow-400">◐ {partial}</span>
                    <span className="text-red-400">✕ {nonCompliant}</span>
                    <span className="text-gray-500 ml-auto">{totalControls} controls</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
