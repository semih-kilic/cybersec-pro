import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useUtilities';

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('privacy.title', 'Privacy Policy')} — CyberSec Pro`);
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
          <h1 className="text-4xl font-bold text-white mb-2">{t('privacy.title', 'Privacy Policy')}</h1>
          <p className="text-gray-400 mb-8">{t('common.lastUpdated', 'Last updated')}: August 15, 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section1Title', '1. Introduction')}</h2>
              <p>{t('privacy.section1Body', 'CyberSec Pro ("we", "our", "us") is committed to protecting your personal data and respecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information in compliance with the General Data Protection Regulation (GDPR) (EU) 2016/679.')}</p>
              <p className="mt-2">Our platform is operated by Semih Kılıç. For data protection inquiries, contact our Data Protection Officer at <a href="mailto:support@cyber-sec-pro.com" className="text-cyan-400 hover:underline">support@cyber-sec-pro.com</a>.</p>
            </section>
            <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h2 className="text-2xl font-semibold text-emerald-300 mb-3 flex items-center gap-2">🔒 Zero-knowledge credential handling</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Credentials never persisted.</strong> SSH keys, passwords, API keys and tokens you provide for a tool run are forwarded to the executing agent in-memory and discarded the moment the job ends. They are not written to our database, logs, backups or analytics pipelines.</li>
                <li><strong>Bring-your-own vault.</strong> You can plug in HashiCorp Vault, AWS/GCP/Azure Secrets Manager or 1Password Connect; we will fetch the secret per-run and never store the resolved value.</li>
                <li><strong>Encryption in transit.</strong> All agent traffic uses TLS 1.3. Reverse-tunnel agents authenticate with short-lived enrollment tokens scoped to a single device.</li>
                <li><strong>Output retention is yours to control.</strong> Scan output is retained only as long as you keep the report; deleting a report wipes the associated raw output and any cached artifacts.</li>
                <li><strong>No third-party telemetry on credentials.</strong> Sentry, PostHog and other observability tools we use are configured to scrub fields matching <code className="text-emerald-200">pass|secret|token|api[_-]?key|credential</code>.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section2Title', '2. Data Controller')}</h2>
              <p>{t('privacy.section2Body', 'The data controller responsible for your personal data is:')}</p>
              <div className="bg-gray-900/50 rounded-lg p-4 mt-2 border border-gray-700">
                <p>{t('privacy.controller.name', 'CyberSec Pro / Semih Kılıç')}</p>
                <p>{t('privacy.controller.email', 'Email: support@cyber-sec-pro.com')}</p>
                <p>{t('privacy.controller.website', 'Website: https://app.cyber-sec-pro.com')}</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section3Title', '3. Data We Collect')}</h2>
              <h3 className="text-lg font-medium text-white mt-4 mb-2">3.1 Account Data</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('privacy.section3.accountItem1', 'Name, email address')}</li>
                <li>{t('privacy.section3.accountItem2', 'Organization name')}</li>
                <li>{t('privacy.section3.accountItem3', 'Payment information (processed by Stripe)')}</li>
                <li>{t('privacy.section3.accountItem4', 'Account preferences and settings')}</li>
              </ul>
              
              <h3 className="text-lg font-medium text-white mt-4 mb-2">3.2 Usage Data</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('privacy.section3.usageItem1', 'Scan targets and results (encrypted at rest)')}</li>
                <li>{t('privacy.section3.usageItem2', 'Tool usage statistics')}</li>
                <li>{t('privacy.section3.usageItem3', 'Login history and session data')}</li>
                <li>{t('privacy.section3.usageItem4', 'API access logs')}</li>
              </ul>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">3.3 Technical Data</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('privacy.section3.technicalItem1', 'IP address (anonymized after 30 days)')}</li>
                <li>{t('privacy.section3.technicalItem2', 'Browser type and version')}</li>
                <li>{t('privacy.section3.technicalItem3', 'Device information')}</li>
                <li>{t('privacy.section3.technicalItem4', 'Cookies (see our Cookie Policy)')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section4Title', '4. Legal Basis for Processing')}</h2>
              <p>{t('privacy.section4Body', 'We process your data under the following legal bases (Art. 6 GDPR):')}</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong className="text-white">Contract Performance</strong> — To provide our security testing services</li>
                <li><strong className="text-white">Legitimate Interest</strong> — To improve our platform and prevent abuse</li>
                <li><strong className="text-white">Consent</strong> — For marketing communications and analytics cookies</li>
                <li><strong className="text-white">Legal Obligation</strong> — To comply with applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section5Title', '5. Your Rights Under GDPR')}</h2>
              <p>{t('privacy.section5Body', 'As an EU/EEA resident, you have the following rights:')}</p>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                {[
                  { right: 'Right of Access', desc: 'Request a copy of your personal data (Art. 15)' },
                  { right: 'Right to Rectification', desc: 'Correct inaccurate personal data (Art. 16)' },
                  { right: 'Right to Erasure', desc: 'Request deletion of your data ("right to be forgotten") (Art. 17)' },
                  { right: 'Right to Restriction', desc: 'Restrict processing of your data (Art. 18)' },
                  { right: 'Right to Portability', desc: 'Receive your data in a portable format (Art. 20)' },
                  { right: 'Right to Object', desc: 'Object to processing based on legitimate interest (Art. 21)' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                    <p className="text-cyan-400 font-medium text-sm">{item.right}</p>
                    <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3">To exercise these rights, visit <Link to="/dashboard/settings" className="text-cyan-400 hover:underline">Account Settings</Link> or email <a href="mailto:support@cyber-sec-pro.com" className="text-cyan-400 hover:underline">support@cyber-sec-pro.com</a>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">5a. PIPEDA Rights (Canada)</h2>
              <p>As a resident of Canada, the Personal Information Protection and Electronic Documents Act (PIPEDA) gives you the following rights:</p>
              <ul className="list-disc list-inside space-y-1 mt-3">
                <li><strong className="text-white">Right to Access</strong> — Request a copy of your personal information we hold (PIPEDA s.8)</li>
                <li><strong className="text-white">Right to Correction</strong> — Correct inaccurate or outdated personal information (PIPEDA s.8)</li>
                <li><strong className="text-white">Consent Requirement</strong> — We collect, use, and disclose your personal information only with your knowledge and consent (PIPEDA s.7)</li>
                <li><strong className="text-white">Right to Withdraw Consent</strong> — Withdraw consent to collection, use, or disclosure at any time, subject to legal/contractual restrictions (PIPEDA s.7(2))</li>
                <li><strong className="text-white">Right to Challenge Compliance</strong> — Challenge our compliance with PIPEDA; complaints can be escalated to the Office of the Privacy Commissioner of Canada</li>
              </ul>
              <p className="mt-3">To exercise these rights, use the <Link to="/dashboard/gdpr" className="text-cyan-400 hover:underline">Consent Management</Link> page or email <a href="mailto:support@cyber-sec-pro.com" className="text-cyan-400 hover:underline">support@cyber-sec-pro.com</a>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">5b. CCPA / CPRA Rights (California)</h2>
              <p>As a resident of California, the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA) gives you the following rights:</p>
              <ul className="list-disc list-inside space-y-1 mt-3">
                <li><strong className="text-white">Right to Know</strong> — Request disclosure of the categories and specific pieces of personal information we have collected about you (CCPA s.1798.110)</li>
                <li><strong className="text-white">Right to Delete</strong> — Request deletion of personal information we have collected, subject to certain exceptions (CCPA s.1798.105)</li>
                <li><strong className="text-white">Right to Correct</strong> — Request correction of inaccurate personal information (CPRA s.1798.106)</li>
                <li><strong className="text-white">Right to Opt-Out of Sale/Sharing</strong> — We do not sell or share your personal information. You may nonetheless opt out of any future sale/sharing or cross-context behavioral advertising (CCPA s.1798.120)</li>
                <li><strong className="text-white">Right to Limit Use of Sensitive PI</strong> — Limit our use of sensitive personal information to that necessary for business purposes (CPRA s.1798.121)</li>
                <li><strong className="text-white">Right to Non-Discrimination</strong> — We will not discriminate against you for exercising any of these rights (CCPA s.1798.125)</li>
              </ul>
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-amber-300 text-sm font-medium mb-2">Notice of Collection</p>
                <p className="text-gray-400 text-sm">
                  We collect the following categories of personal information: identifiers (name, email, IP address), commercial information (scan history, payment records via Stripe), internet activity (usage logs, device data), and geolocation data (approximate, from IP). We do not sell personal information and do not use it for cross-context behavioral advertising. Your information is retained for the periods described in Section 6 and deleted upon request.
                </p>
              </div>
              <p className="mt-3">To submit a verifiable request under CCPA/CPRA, email <a href="mailto:support@cyber-sec-pro.com" className="text-cyan-400 hover:underline">support@cyber-sec-pro.com</a> or use the <Link to="/dashboard/gdpr" className="text-cyan-400 hover:underline">Data Rights</Link> page. We will respond within 45 days (extendable by 45 additional days with notice). Authorized agents may submit requests on your behalf.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section6Title', '6. Data Retention')}</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('privacy.section6.item1', 'Account data: Retained while your account is active + 30 days after deletion')}</li>
                <li>{t('privacy.section6.item2', 'Scan results: Retained for 90 days, then automatically purged')}</li>
                <li>{t('privacy.section6.item3', 'Access logs: Retained for 12 months for security purposes')}</li>
                <li>{t('privacy.section6.item4', 'Payment records: Retained as required by tax law (typically 7 years)')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section7Title', '7. Data Transfers')}</h2>
              <p>{t('privacy.section7Body', 'Your data is processed within the European Union. If data must be transferred outside the EU/EEA, we ensure appropriate safeguards are in place (Standard Contractual Clauses or adequacy decisions per Art. 46 GDPR).')}</p>
              <p className="mt-3">For Canadian residents, your personal information may be transferred outside of Canada. Under PIPEDA s.4.1.4, we remain responsible for the protection of your personal information while it is processed by our service providers. Transfers outside Canada are subject to contractual clauses requiring equivalent privacy protection. Contact us for details on the jurisdictions where your data may be processed.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">8. Sub-Processors</h2>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-white">Stripe</strong> — Payment processing (PCI DSS Level 1 compliant)</li>
                <li><strong className="text-white">Cloudflare</strong> — CDN and DDoS protection (EU data centers)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">9. Data Security</h2>
              <p>{t('privacy.section9Body', 'We implement industry-standard security measures including:')}</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>{t('privacy.section9.item1', 'TLS 1.3 encryption for all data in transit')}</li>
                <li>{t('privacy.section9.item2', 'AES-256 encryption for data at rest')}</li>
                <li>{t('privacy.section9.item3', 'Regular security audits and penetration testing')}</li>
                <li>{t('privacy.section9.item4', 'Role-based access control (RBAC)')}</li>
                <li>{t('privacy.section9.item5', 'Automated data backup with encryption')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section10Title', '10. Supervisory Authority')}</h2>
              <p>{t('privacy.section10Body', 'If you believe your data protection rights have been violated, you have the right to lodge a complaint with a supervisory authority in the EU Member State of your habitual residence, place of work, or place of the alleged infringement.')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section11Title', '11. Contact')}</h2>
              <p>{t('privacy.section11Body', 'For any questions regarding this Privacy Policy or your data rights:')}</p>
              <div className="bg-gray-900/50 rounded-lg p-4 mt-2 border border-gray-700">
                <p>Email: <a href="mailto:support@cyber-sec-pro.com" className="text-cyan-400 hover:underline">support@cyber-sec-pro.com</a></p>
                <p>{t('privacy.section11.responseTime', 'Response time: Within 30 days (as required by GDPR Art. 12)')}</p>
              </div>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link to="/dashboard/terms" className="text-gray-400 hover:text-white transition text-sm">{t('privacy.related.termsOfService', 'Terms of Service')}</Link>
          <span className="text-gray-600">•</span>
          <Link to="/dashboard/gdpr" className="text-gray-400 hover:text-white transition text-sm">{t('privacy.related.gdprInfo', 'GDPR Information')}</Link>
          <span className="text-gray-600">•</span>
          <Link to="/" className="text-gray-400 hover:text-white transition text-sm">{t('privacy.related.home', 'Home')}</Link>
        </div>
      </div>
    </div>
  );
}
