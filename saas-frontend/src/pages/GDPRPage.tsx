import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useUtilities';

interface ConsentRecord {
  purpose: string;
  category: string;
  status: string;
  version: string | null;
  recorded_at: string;
  withdrawn_at: string | null;
}

export default function GDPRPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('gdpr.title', 'GDPR Compliance')} — CyberSec Pro`);
  const { isAuthenticated, token } = useAuth();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [consentsLoaded, setConsentsLoaded] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [consentError, setConsentError] = useState('');

  const loadConsents = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/consent', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConsents(data.consents || []);
      }
    } catch {
      // non-fatal
    } finally {
      setConsentsLoaded(true);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadConsents();
  }, [isAuthenticated]);

  const handleWithdraw = async (purpose: string) => {
    if (!token) return;
    setWithdrawing(purpose);
    setConsentError('');
    try {
      const res = await fetch('/api/v1/consent/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ purpose })
      });
      if (res.ok) {
        await loadConsents();
      } else {
        const data = await res.json().catch(() => ({}));
        setConsentError(data.error || 'Failed to withdraw consent.');
      }
    } catch {
      setConsentError('Request failed. Please try again.');
    } finally {
      setWithdrawing(null);
    }
  };

  const handleDataExport = async () => {
    if (!token) return;
    setExportLoading(true);
    try {
      const res = await fetch('/api/v1/gdpr/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
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
      alert('Export request failed. Please contact support@cyber-sec-pro.com');
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
        alert('Your account data has been deleted and anonymized immediately. You are now signed out.');
        window.location.href = '/';
      } else {
        alert('Failed to submit deletion request. Please contact support@cyber-sec-pro.com');
      }
    } catch {
      alert('Request failed. Please contact support@cyber-sec-pro.com');
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
            <span className="text-xl font-bold text-white">{t('common.appName', 'CyberSec Pro')}</span>
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
              <h2 className="text-2xl font-semibold text-white mb-3">{t('gdpr.commitmentTitle', 'Our Commitment')}</h2>
              <p className="text-gray-300">{t('gdpr.commitmentBody', 'CyberSec Pro is fully committed to GDPR compliance. We respect your privacy and give you full control over your personal data. As an EU-focused platform, data protection is at the core of everything we do.')}</p>
            </section>

            {/* GDPR Rights Cards */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">{t('gdpr.rightsTitle', 'Your GDPR Rights')}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  {
                    icon: '📋',
                    title: t('gdpr.rights.access.title', 'Right of Access (Art. 15)'),
                    desc: t('gdpr.rights.access.desc', 'You can request a complete copy of all personal data we hold about you.'),
                    action: isAuthenticated ? t('gdpr.rights.access.action', 'Export My Data') : null,
                  },
                  {
                    icon: '✏️',
                    title: t('gdpr.rights.rectification.title', 'Right to Rectification (Art. 16)'),
                    desc: t('gdpr.rights.rectification.desc', 'You can correct any inaccurate or incomplete personal data in your account settings.'),
                    action: isAuthenticated ? t('gdpr.rights.rectification.action', 'Go to Settings') : null,
                    link: '/dashboard/settings',
                  },
                  {
                    icon: '🗑️',
                    title: t('gdpr.rights.erasure.title', 'Right to Erasure (Art. 17)'),
                    desc: t('gdpr.rights.erasure.desc', 'You can request complete deletion of your account and all associated data.'),
                    action: isAuthenticated ? t('gdpr.rights.erasure.action', 'Delete My Account') : null,
                    danger: true,
                  },
                  {
                    icon: '⏸️',
                    title: t('gdpr.rights.restriction.title', 'Right to Restriction (Art. 18)'),
                    desc: t('gdpr.rights.restriction.desc', 'You can request that we restrict processing of your data while a dispute is resolved.'),
                  },
                  {
                    icon: '📦',
                    title: t('gdpr.rights.portability.title', 'Right to Data Portability (Art. 20)'),
                    desc: t('gdpr.rights.portability.desc', 'You can receive your data in a structured, machine-readable format (JSON).'),
                    action: isAuthenticated ? t('gdpr.rights.portability.action', 'Download Data') : null,
                  },
                  {
                    icon: '🚫',
                    title: t('gdpr.rights.object.title', 'Right to Object (Art. 21)'),
                    desc: t('gdpr.rights.object.desc', 'You can object to processing of your data for direct marketing purposes.'),
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
                              {exportLoading ? t('gdpr.preparingExport', 'Preparing export...') : right.action}
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
                    <Link to="/login" className="underline hover:text-blue-300">{t('gdpr.signIn', 'Sign in')}</Link> {t('gdpr.signInPrompt', 'to exercise your data rights directly from this page, or contact us at')} <a href="mailto:support@cyber-sec-pro.com" className="underline hover:text-blue-300">support@cyber-sec-pro.com</a>.
                  </p>
                </div>
              )}
            </section>

            {/* Consent Management */}
            {isAuthenticated && (
              <section>
                <h2 className="text-2xl font-semibold text-white mb-3">{t('gdpr.consentTitle', 'Consent Management')}</h2>
                <p className="text-gray-300 text-sm mb-4">
                  {t('gdpr.consentBody', 'Your privacy choices in one place. Withdraw consent for marketing and non-essential processing at any time — the change is immediate (PIPEDA / CCPA / CPRA / GDPR Art. 7).')}
                </p>
                {consentError && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{consentError}</p>
                  </div>
                )}
                {consentsLoaded && consents.length === 0 ? (
                  <p className="text-gray-500 text-sm">{t('gdpr.noConsent', 'No consent records found.')}</p>
                ) : (
                  <div className="space-y-2">
                    {consents.map((c, i) => (
                      <div key={i} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500' : 'bg-gray-600'}`}></span>
                          <div>
                            <p className="text-white font-medium capitalize">{c.purpose.replace(/-/g, ' ')}</p>
                            <p className="text-gray-500 text-xs">
                              {c.category} · {t('gdpr.recorded', 'Recorded')}: {new Date(c.recorded_at).toLocaleDateString()}
                              {c.withdrawn_at && ` · ${t('gdpr.withdrawn', 'Withdrawn')}: ${new Date(c.withdrawn_at).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        {c.status === 'active' ? (
                          <button
                            onClick={() => handleWithdraw(c.purpose)}
                            disabled={withdrawing === c.purpose}
                            className="px-3 py-1.5 bg-amber-600/20 text-amber-400 text-xs rounded-lg hover:bg-amber-600/30 transition border border-amber-500/20 disabled:opacity-50 whitespace-nowrap"
                          >
                            {withdrawing === c.purpose ? t('common.processing', 'Processing...') : t('gdpr.withdraw', 'Withdraw')}
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs whitespace-nowrap">{t('gdpr.withdrawnStatus', 'Withdrawn')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Data Processing */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('gdpr.dpaTitle', 'Data Processing Agreement')}</h2>
              <p className="text-gray-300">{t('gdpr.dpaIntro', 'For enterprise customers, we provide a Data Processing Agreement (DPA) in compliance with Art. 28 GDPR. Our DPA covers:')}</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-gray-300">
                <li>{t('gdpr.dpaItem1', 'Nature and purpose of data processing')}</li>
                <li>{t('gdpr.dpaItem2', 'Types of personal data processed')}</li>
                <li>{t('gdpr.dpaItem3', 'Categories of data subjects')}</li>
                <li>{t('gdpr.dpaItem4', 'Security measures and sub-processor management')}</li>
                <li>{t('gdpr.dpaItem5', 'Data breach notification procedures (72-hour window)')}</li>
              </ul>
              <p className="text-gray-400 text-sm mt-3">{t('gdpr.dpaRequest', 'To request a DPA, contact')} <a href="mailto:support@cyber-sec-pro.com" className="text-cyan-400 hover:underline">support@cyber-sec-pro.com</a>.</p>
            </section>

            {/* Security Measures */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('gdpr.measuresTitle', 'Technical & Organizational Measures')}</h2>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { icon: '🔒', title: t('gdpr.measure.encryption', 'Encryption'), items: [t('gdpr.measure.encryptionItem1', 'TLS 1.3 in transit'), t('gdpr.measure.encryptionItem2', 'AES-256 at rest')] },
                  { icon: '🏰', title: t('gdpr.measure.infrastructure', 'Infrastructure'), items: [t('gdpr.measure.infrastructureItem1', 'EU data centers'), t('gdpr.measure.infrastructureItem2', 'DDoS protection')] },
                  { icon: '🔑', title: t('gdpr.measure.accessControl', 'Access Control'), items: [t('gdpr.measure.accessControlItem1', 'RBAC'), t('gdpr.measure.accessControlItem2', 'MFA support'), t('gdpr.measure.accessControlItem3', 'Audit logs')] },
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
              <h2 className="text-xl font-semibold text-white mb-2">{t('gdpr.dpoTitle', 'Data Protection Officer')}</h2>
              <p className="text-gray-300 mb-3">{t('gdpr.dpoIntro', 'For GDPR-related inquiries, contact our DPO:')}</p>
              <div className="flex flex-col gap-1">
                <p className="text-gray-300">📧 <a href="mailto:support@cyber-sec-pro.com" className="text-cyan-400 hover:underline">support@cyber-sec-pro.com</a></p>
                <p className="text-gray-400 text-sm">{t('gdpr.dpoResponseTime', 'Response within 30 days as required by GDPR Art. 12')}</p>
              </div>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link to="/dashboard/privacy" className="text-gray-400 hover:text-white transition text-sm">{t('gdpr.related.privacyPolicy', 'Privacy Policy')}</Link>
          <span className="text-gray-600">•</span>
          <Link to="/dashboard/terms" className="text-gray-400 hover:text-white transition text-sm">{t('gdpr.related.termsOfService', 'Terms of Service')}</Link>
          <span className="text-gray-600">•</span>
          <Link to="/" className="text-gray-400 hover:text-white transition text-sm">{t('gdpr.related.home', 'Home')}</Link>
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
              <h3 className="text-xl font-bold text-white text-center mb-2">{t('gdpr.deleteModal.title', 'Delete Your Account?')}</h3>
              <p className="text-gray-400 text-center text-sm mb-6">
                {t('gdpr.deleteModal.bodyPrefix', 'This action is')} <strong className="text-red-400">{t('gdpr.deleteModal.irreversible', 'irreversible')}</strong>. {t('gdpr.deleteModal.bodySuffix', 'All your data including scan results, reports, projects, and agent configurations will be permanently deleted and anonymized immediately.')}
              </p>
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 mb-6">
                <p className="text-red-400 text-sm">
                  {t('gdpr.deleteModal.notice', 'Under GDPR Art. 17, you have the right to erasure. We will process your request and send a confirmation email.')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition font-medium"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleAccountDeletion}
                  disabled={deleteLoading}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50"
                >
                  {deleteLoading ? t('common.processing', 'Processing...') : t('gdpr.deleteModal.confirmAction', 'Delete My Account')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
