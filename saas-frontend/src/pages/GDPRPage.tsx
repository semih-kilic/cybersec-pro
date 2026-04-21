import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useUtilities';

export default function GDPRPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('gdpr.title', 'GDPR Compliance')} — CyberSec Pro`);
  const { isAuthenticated, token } = useAuth();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDataExport = async () => {
    if (!token) return;
    setExportLoading(true);
    try {
      const res = await fetch('/api/v1/gdpr/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cybersecpro-my-data.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert('Failed to export data. Please try again or contact support.');
      }
    } catch {
      alert('Export request failed. Please contact cybersecpro@semihkilic.com');
    } finally {
      setExportLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (!token) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/v1/gdpr/delete-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: true })
      });
      if (res.ok) {
        alert('Account deletion request submitted. Your account and data will be deleted within 30 days. You will receive a confirmation email.');
        window.location.href = '/';
      } else {
        alert('Failed to submit deletion request. Please contact cybersecpro@semihkilic.com');
      }
    } catch {
      alert('Request failed. Please contact cybersecpro@semihkilic.com');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">CyberSec Pro</span>
          </Link>
          <Link to="/" className="text-gray-400 hover:text-white transition text-sm">← {t('common.backToHome', 'Back to Home')}</Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="bg-gray-800/50 rounded-2xl p-8 md:p-12 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🇪🇺</span>
            <h1 className="text-4xl font-bold text-white">{t('gdpr.title', 'GDPR Compliance')}</h1>
          </div>
          <p className="text-gray-400 mb-8">{t('gdpr.subtitle', 'Your data protection rights under the General Data Protection Regulation')}</p>

          <div className="space-y-8">
            {/* Overview */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">Our Commitment</h2>
              <p className="text-gray-300">CyberSec Pro is fully committed to GDPR compliance. We respect your privacy and give you full control over your personal data. As an EU-focused platform, data protection is at the core of everything we do.</p>
            </section>

            {/* GDPR Rights Cards */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Your GDPR Rights</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  {
                    icon: '📋',
                    title: 'Right of Access (Art. 15)',
                    desc: 'You can request a complete copy of all personal data we hold about you.',
                    action: isAuthenticated ? 'Export My Data' : null,
                  },
                  {
                    icon: '✏️',
                    title: 'Right to Rectification (Art. 16)',
                    desc: 'You can correct any inaccurate or incomplete personal data in your account settings.',
                    action: isAuthenticated ? 'Go to Settings' : null,
                    link: '/dashboard/settings',
                  },
                  {
                    icon: '🗑️',
                    title: 'Right to Erasure (Art. 17)',
                    desc: 'You can request complete deletion of your account and all associated data.',
                    action: isAuthenticated ? 'Delete My Account' : null,
                    danger: true,
                  },
                  {
                    icon: '⏸️',
                    title: 'Right to Restriction (Art. 18)',
                    desc: 'You can request that we restrict processing of your data while a dispute is resolved.',
                  },
                  {
                    icon: '📦',
                    title: 'Right to Data Portability (Art. 20)',
                    desc: 'You can receive your data in a structured, machine-readable format (JSON).',
                    action: isAuthenticated ? 'Download Data' : null,
                  },
                  {
                    icon: '🚫',
                    title: 'Right to Object (Art. 21)',
                    desc: 'You can object to processing of your data for direct marketing purposes.',
                  },
                ].map((right, i) => (
                  <div key={i} className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{right.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">{right.title}</h3>
                        <p className="text-gray-400 text-sm mt-1">{right.desc}</p>
                        {right.action && (
                          right.link ? (
                            <Link to={right.link} className="mt-3 inline-block px-4 py-1.5 bg-cyan-600/20 text-cyan-400 text-sm rounded-lg hover:bg-cyan-600/30 transition border border-cyan-500/20">
                              {right.action}
                            </Link>
                          ) : right.danger ? (
                            <button
                              onClick={() => setShowDeleteConfirm(true)}
                              className="mt-3 px-4 py-1.5 bg-red-600/20 text-red-400 text-sm rounded-lg hover:bg-red-600/30 transition border border-red-500/20"
                            >
                              {right.action}
                            </button>
                          ) : (
                            <button
                              onClick={handleDataExport}
                              disabled={exportLoading}
                              className="mt-3 px-4 py-1.5 bg-cyan-600/20 text-cyan-400 text-sm rounded-lg hover:bg-cyan-600/30 transition border border-cyan-500/20 disabled:opacity-50"
                            >
                              {exportLoading ? 'Preparing export...' : right.action}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!isAuthenticated && (
                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-400 text-sm">
                    <Link to="/login" className="underline hover:text-blue-300">Sign in</Link> to exercise your data rights directly from this page, or contact us at <a href="mailto:cybersecpro@semihkilic.com" className="underline hover:text-blue-300">cybersecpro@semihkilic.com</a>.
                  </p>
                </div>
              )}
            </section>

            {/* Data Processing */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">Data Processing Agreement</h2>
              <p className="text-gray-300">For enterprise customers, we provide a Data Processing Agreement (DPA) in compliance with Art. 28 GDPR. Our DPA covers:</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-gray-300">
                <li>Nature and purpose of data processing</li>
                <li>Types of personal data processed</li>
                <li>Categories of data subjects</li>
                <li>Security measures and sub-processor management</li>
                <li>Data breach notification procedures (72-hour window)</li>
              </ul>
              <p className="text-gray-400 text-sm mt-3">To request a DPA, contact <a href="mailto:cybersecpro@semihkilic.com" className="text-cyan-400 hover:underline">cybersecpro@semihkilic.com</a>.</p>
            </section>

            {/* Security Measures */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">Technical & Organizational Measures</h2>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { icon: '🔒', title: 'Encryption', items: ['TLS 1.3 in transit', 'AES-256 at rest'] },
                  { icon: '🏰', title: 'Infrastructure', items: ['EU data centers', 'DDoS protection'] },
                  { icon: '🔑', title: 'Access Control', items: ['RBAC', 'MFA support', 'Audit logs'] },
                ].map((measure, i) => (
                  <div key={i} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                    <span className="text-xl">{measure.icon}</span>
                    <h4 className="text-white font-medium mt-2 mb-2">{measure.title}</h4>
                    {measure.items.map((item, j) => (
                      <p key={j} className="text-gray-400 text-sm">• {item}</p>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            {/* Contact DPO */}
            <section className="bg-cyan-900/10 border border-cyan-500/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-2">Data Protection Officer</h2>
              <p className="text-gray-300 mb-3">For GDPR-related inquiries, contact our DPO:</p>
              <div className="flex flex-col gap-1">
                <p className="text-gray-300">📧 <a href="mailto:cybersecpro@semihkilic.com" className="text-cyan-400 hover:underline">cybersecpro@semihkilic.com</a></p>
                <p className="text-gray-400 text-sm">Response within 30 days as required by GDPR Art. 12</p>
              </div>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link to="/dashboard/privacy" className="text-gray-400 hover:text-white transition text-sm">Privacy Policy</Link>
          <span className="text-gray-600">•</span>
          <Link to="/dashboard/terms" className="text-gray-400 hover:text-white transition text-sm">Terms of Service</Link>
          <span className="text-gray-600">•</span>
          <Link to="/" className="text-gray-400 hover:text-white transition text-sm">Home</Link>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full border border-red-500/30 shadow-2xl">
            <div className="p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Delete Your Account?</h3>
              <p className="text-gray-400 text-center text-sm mb-6">
                This action is <strong className="text-red-400">irreversible</strong>. All your data including scan results, reports, projects, and agent configurations will be permanently deleted within 30 days.
              </p>
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 mb-6">
                <p className="text-red-400 text-sm">
                  Under GDPR Art. 17, you have the right to erasure. We will process your request and send a confirmation email.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAccountDeletion}
                  disabled={deleteLoading}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50"
                >
                  {deleteLoading ? 'Processing...' : 'Delete My Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
