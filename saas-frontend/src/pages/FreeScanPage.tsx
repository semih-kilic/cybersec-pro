import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const FEATURES = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    titleKey: 'freeScan.feature1Title',
    titleDefault: 'Automated Vulnerability Scanning',
    descKey: 'freeScan.feature1Desc',
    descDefault: 'Enterprise-grade Nmap and Nikto scans run against your domain to identify open ports and web vulnerabilities.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    titleKey: 'freeScan.feature2Title',
    titleDefault: 'Professional PDF Report',
    descKey: 'freeScan.feature2Desc',
    descDefault: 'Receive a comprehensive, audit-ready PDF report with severity ratings, screenshots, and actionable remediation steps.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    titleKey: 'freeScan.feature3Title',
    titleDefault: 'Results in Under 5 Minutes',
    descKey: 'freeScan.feature3Desc',
    descDefault: 'Our parallelized scanning infrastructure delivers your vulnerability report in minutes, not days.',
  },
];

const FAQ_ITEMS = [
  {
    qKey: 'freeScan.faq1Q',
    qDefault: 'Is this really free?',
    aKey: 'freeScan.faq1A',
    aDefault: 'Yes. You get one complete vulnerability report at no cost, with no credit card required. We believe every organization deserves access to basic security testing.',
  },
  {
    qKey: 'freeScan.faq2Q',
    qDefault: 'Is it safe to scan my domain?',
    aKey: 'freeScan.faq2A',
    aDefault: 'Absolutely. Our scans use passive and safe active techniques that will not disrupt your services. We never perform exploit-level testing in the free report.',
  },
  {
    qKey: 'freeScan.faq3Q',
    qDefault: 'What do I receive?',
    aKey: 'freeScan.faq3A',
    aDefault: 'You will receive a professional PDF report covering open ports, running services, web technology fingerprinting, known vulnerabilities, and prioritized remediation advice.',
  },
  {
    qKey: 'freeScan.faq4Q',
    qDefault: 'Can I scan multiple domains?',
    aKey: 'freeScan.faq4A',
    aDefault: 'The free report covers one domain. For unlimited domains and recurring scans, sign up for a CyberSec Pro Starter or Professional plan.',
  },
];

export function FreeScanPage() {
  const { t } = useTranslation();
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim() || !email.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link to="/" className="flex items-center space-x-3 w-fit">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white">CyberSec Pro</span>
        </Link>
      </nav>

      <section className="max-w-4xl mx-auto px-4 pt-8 pb-20 text-center">
        <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold mb-6 tracking-wide uppercase">
          {t('freeScan.badge', '100% Free — No Credit Card')}
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
          {t('freeScan.heroTitle', 'Get Your Free Vulnerability Report')}
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          {t('freeScan.heroSubtitle', 'Enter your domain below and receive a professional security assessment report within minutes.')}
        </p>

        {submitted ? (
          <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-8 max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('freeScan.successTitle', 'Report Generation Started!')}</h2>
            <p className="text-gray-400 mb-4">
              {t('freeScan.successBody', 'We are scanning your domain now. Your report will be sent to')} <span className="text-white font-medium">{email}</span> {t('freeScan.successBodySuffix', 'within minutes.')}
            </p>
            <Link to="/" className="text-cyan-400 hover:text-cyan-300 text-sm transition">
              {t('freeScan.backHome', 'Back to Home')} →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 max-w-lg mx-auto text-left">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t('freeScan.domainLabel', 'Domain to Scan')} *
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t('freeScan.emailLabel', 'Email Address')} *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t('freeScan.companyLabel', 'Company')} <span className="text-gray-500">({t('freeScan.optional', 'optional')})</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
            >
              {t('freeScan.submitButton', 'Generate Free Report')}
            </button>
          </form>
        )}
      </section>

      <section className="py-20 px-4 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            {t('freeScan.featuresTitle', 'What You Get')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((feat, i) => (
              <div key={i} className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/30 transition text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t(feat.titleKey, feat.titleDefault)}
                </h3>
                <p className="text-gray-400 text-sm">
                  {t(feat.descKey, feat.descDefault)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            {t('freeScan.faqTitle', 'Frequently Asked Questions')}
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-800/50 transition"
                >
                  <span className="font-medium text-white text-sm">{t(item.qKey, item.qDefault)}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">
                    {t(item.aKey, item.aDefault)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-full text-sm text-gray-300">
            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {t('freeScan.socialProof', 'Trusted by 2,400+ security teams worldwide')}
          </div>
        </div>
      </section>

      <footer className="py-10 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link to="/" className="text-gray-400 text-sm hover:text-white transition">
            CyberSec Pro
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <Link to="/dashboard/privacy" className="hover:text-gray-300 transition">{t('landing.footer.privacyPolicy', 'Privacy Policy')}</Link>
            <Link to="/dashboard/terms" className="hover:text-gray-300 transition">{t('landing.footer.termsOfService', 'Terms of Service')}</Link>
            <Link to="/login" className="hover:text-gray-300 transition">{t('auth.signIn', 'Sign In')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
