import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useToolCounts } from '../hooks/useApiQueries';

/**
 * 🐉 CyberSec Pro Landing Page
 * Modern cybersecurity SaaS platform landing
 */
export function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const { data: toolCounts } = useToolCounts();
  const totalTools = toolCounts?.total;
  const totalCategories = toolCounts?.categories_total;
  const trialDays = toolCounts?.trial_days;
  const replaceCounts = (s: string) => {
    let out = s;
    if (totalTools) out = out.replace(/\b(401|396|778|\d{3,4})(?=\s*(Professional|professional|penetration|Penetration|Penetrationstest|outils|herramientas|strumenti|Kali))/g, String(totalTools));
    if (totalCategories) out = out.replace(/\b(61|89)\b(?=\s*(categories|catégories|categorías|categorie|Kategorien))/g, String(totalCategories));
    if (trialDays) out = out.replace(/\b14\b(?=[\s-]*(day|days|Tage|jours|días|giorni|gün))/g, String(trialDays));
    return out;
  };
  const dynamicBadge = replaceCounts(t('landing.badge'));
  const dynamicSubheadline = replaceCounts(t('landing.subheadline'));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Nav */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between border-2 border-lime-400/40 bg-zinc-900 px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">{t('common.appName', 'CyberSec Pro')}</span>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-gray-400 hidden sm:inline">
                    {t('landing.welcomeUser', { name: user?.first_name || 'User' })}
                  </span>
                  <Link to="/dashboard" className="px-4 py-2 bg-lime-400 text-black font-bold rounded-none hover:bg-lime-300 transition">
                    {t('landing.goToDashboard')}
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-300 hover:text-white transition">
                    {t('auth.signIn')}
                  </Link>
                  <Link to="/register" className="px-4 py-2 bg-lime-400 text-black font-bold rounded-none hover:bg-lime-300 transition">
                    {t('landing.startTrial')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-block px-4 py-2 bg-lime-400/10 border-2 border-lime-400/40 text-lime-300 text-sm font-semibold tracking-wide mb-8">
            {dynamicBadge}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            {t('landing.headlinePart1')}<br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Kali Linux
            </span><br />
            {t('landing.headlinePart2')}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            {dynamicSubheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link to="/dashboard" className="px-8 py-4 bg-lime-400 text-black text-lg font-bold rounded-none border-2 border-lime-300 hover:bg-lime-300 transition">
                {t('landing.goToDashboard')}
              </Link>
            ) : (
              <Link to="/register" className="px-8 py-4 bg-lime-400 text-black text-lg font-bold rounded-none border-2 border-lime-300 hover:bg-lime-300 transition">
                {t('landing.startTrial14')}
              </Link>
            )}
            <a href="#features" className="px-8 py-4 bg-zinc-900 text-white text-lg font-semibold rounded-none hover:bg-zinc-800 transition border-2 border-zinc-600">
              {t('landing.seeFeatures')}
            </a>
          </div>
        </div>
      </header>

      {/* Live Demo Video Section */}
      <section className="py-16 px-4 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-medium mb-4">
              {t('landing.demoTitle', 'See CyberSec Pro in Action')}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {t('landing.demoSubtitle', 'Watch a real security scan from login to report — updated weekly with latest features.')}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Watch a real security scan from login to report — updated weekly with latest features.
            </p>
          </div>

          {/* Video Player */}
          <div className="relative rounded-2xl overflow-hidden border border-gray-700 shadow-2xl shadow-cyan-500/10 bg-gray-950 aspect-video group">
            {!isVideoPlaying ? (
              <>
                {/* Thumbnail / Placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-cyan-900/20 flex items-center justify-center">
                  <div className="text-center">
                    {/* Terminal Preview */}
                    <div className="w-[600px] max-w-[80vw] mx-auto mb-6 bg-gray-950 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border-b border-gray-700">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-gray-500 text-xs ml-2">{t('landing.terminalTitle', 'CyberSec Pro Terminal')}</span>
                      </div>
                      <div className="p-4 font-mono text-xs text-left space-y-1">
                        <p className="text-green-400">$ nmap -sV -sC scanme.nmap.org</p>
                        <p className="text-gray-500">{t('landing.terminalStarting', 'Starting Nmap 7.94 ( https://nmap.org )')}</p>
                        <p className="text-cyan-400">{t('landing.terminalHeader', 'PORT   STATE SERVICE VERSION')}</p>
                        <p className="text-white">22/tcp open  ssh     OpenSSH 6.6p1</p>
                        <p className="text-white">80/tcp open  http    Apache httpd 2.4.7</p>
                        <p className="text-green-400">{t('landing.terminalDone', 'Nmap done: 1 IP address (1 host up)')}</p>
                      </div>
                    </div>

                    {/* Play Button */}
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/25 group"
                    >
                      <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {t('landing.watchDemo', 'Watch 2-Min Demo')}
                    </button>
                    <p className="text-gray-500 text-sm mt-3">{t('landing.noSignup', 'No signup required')}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Embedded Video Player */}
                <video
                  className="w-full h-full"
                  autoPlay
                  controls
                  playsInline
                  poster="/dashboard/videos/demo-thumbnail.png"
                  onEnded={() => setIsVideoPlaying(false)}
                >
                  <source src="/dashboard/videos/demo-latest.mp4" type="video/mp4" />
                  {/* Fallback to YouTube/Vimeo embed if local video not available */}
                  Your browser does not support the video tag.
                </video>

                {/* Close button */}
                <button
                  onClick={() => setIsVideoPlaying(false)}
                  className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition z-10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Feature pills under video */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {[
              t('landing.pill.loginDashboard', 'Login & Dashboard'),
              t('landing.pill.liveNmap', 'Live Nmap Scan'),
              t('landing.pill.realtimeOutput', 'Real-time Output'),
              t('landing.pill.pdfReports', 'PDF Reports'),
              t('landing.pill.remoteAgents', 'Remote Agents'),
            ].map((feat, i) => (
              <span key={i} className="px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded-full text-gray-400 text-xs">
                {['🔐', '🔍', '📡', '📊', '🖥️'][i]} {feat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">{t('landing.featuresTitle')}</h2>
            <p className="text-gray-400 text-lg">{t('landing.featuresSubtitle')}</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🔍', title: 'Information Gathering', desc: '130+ tools for reconnaissance, DNS recon, subdomain enumeration, OSINT' },
              { icon: '🌐', title: 'Web Application', desc: '100+ tools for web scanning, SQL injection, XSS testing, fuzzing' },
              { icon: '🔐', title: 'Password Attacks', desc: '80+ tools for hash cracking, brute force, dictionary attacks' },
              { icon: '🛡️', title: 'Vulnerability Analysis', desc: '60+ tools for scanning, SSL testing, vulnerability detection' },
              { icon: '💀', title: 'Exploitation', desc: '50+ tools including Metasploit Framework for authorized testing' },
              { icon: '📊', title: 'Forensics & Reporting', desc: '60+ tools for memory analysis, file carving, GDPR-compliant audit reports' },
            ].map((feature, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-cyan-500/50 transition">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">{t('landing.pricingTitle')}</h2>
            <p className="text-gray-400 text-lg">{t('landing.pricingSubtitle')}</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free Trial */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 flex flex-col">
              <div className="text-lg font-medium text-green-400 mb-2">{t('landing.plan.freeTrial', 'Free Trial')}</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">€0</span>
                <span className="text-gray-400">{t('landing.plan.freeCycle', '/3 days')}</span>
              </div>
              <ul className="space-y-2 mb-6 text-gray-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> {t('landing.plan.freeItem1', '1 free security scan')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> {t('landing.plan.freeItem2', `Full ${totalTools}-tool coverage`, { count: totalTools })}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> {t('landing.plan.freeItem3', 'PDF report with findings')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> {t('landing.plan.freeItem4', 'No credit card required')}
                </li>
              </ul>
              <div className="mt-auto">
                <Link to="/register" className="block w-full py-2 bg-gray-700 text-white text-center rounded-xl hover:bg-gray-600 transition text-sm">
                  {t('landing.plan.startFreeScan', 'Start Free Scan')}
                </Link>
              </div>
            </div>

            {/* Starter */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-blue-500/50 flex flex-col">
              <div className="text-lg font-medium text-blue-400 mb-2">{t('landing.plan.starter', 'Starter')}</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">€99</span>
                <span className="text-gray-400">{t('landing.plan.monthly', '/month')}</span>
              </div>
              <ul className="space-y-2 mb-6 text-gray-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">✓</span> {t('landing.plan.starterItem1', '1 domain/application')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">✓</span> {t('landing.plan.starterItem2', 'Weekly automated scans')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">✓</span> {t('landing.plan.starterItem3', 'Email vulnerability alerts')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">✓</span> {t('landing.plan.starterItem4', 'PDF & HTML reports')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">✓</span> {t('landing.plan.starterItem5', 'Email support (48h)')}
                </li>
              </ul>
              <div className="mt-auto">
                <Link to="/register" className="block w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 text-center rounded-xl hover:bg-blue-500/30 transition text-sm">
                  {t('common.getStarted', 'Get Started')}
                </Link>
              </div>
            </div>

            {/* Professional */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border-2 border-emerald-500/80 relative shadow-xl shadow-emerald-500/5 flex flex-col">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[11px] font-bold rounded-full z-10 tracking-widest uppercase shadow-lg shadow-emerald-500/30 whitespace-nowrap">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                {t('upgrade.popular')}
              </div>
              <div className="text-lg font-medium text-emerald-400 mb-2">{t('landing.plan.professional', 'Professional')}</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">€299</span>
                <span className="text-gray-400">{t('landing.plan.monthly', '/month')}</span>
              </div>
              <ul className="space-y-2 mb-6 text-gray-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> {t('landing.plan.proItem1', 'Up to 5 domains')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> {t('landing.plan.proItem2', 'Daily automated scans')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> {t('landing.plan.proItem3', 'API + CI/CD integration')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> {t('landing.plan.proItem4', 'Compliance reports')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> {t('landing.plan.proItem5', 'Priority support (24h)')}
                </li>
              </ul>
              <div className="mt-auto">
                <Link to="/register" className="block w-full py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-center rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition text-sm">
                  {t('common.getStarted', 'Get Started')}
                </Link>
              </div>
            </div>

            {/* Enterprise */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-purple-500/50 flex flex-col">
              <div className="text-lg font-medium text-purple-400 mb-2">{t('landing.plan.enterprise', 'Enterprise')}</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">€799</span>
                <span className="text-gray-400">{t('landing.plan.monthly', '/month')}</span>
              </div>
              <ul className="space-y-2 mb-6 text-gray-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">✓</span> <strong>{totalTools}</strong> {t('landing.plan.enterpriseItem1', 'All Tools')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">✓</span> {t('landing.plan.enterpriseItem2', 'Unlimited everything')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">✓</span> {t('landing.plan.enterpriseItem3', 'SSO / SAML / LDAP')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">✓</span> {t('landing.plan.enterpriseItem4', 'Dedicated account manager')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">✓</span> 24/7 priority support
                </li>
              </ul>
              <div className="mt-auto">
                <Link to="/contact" className="block w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center font-semibold rounded-xl hover:from-purple-400 hover:to-pink-400 transition text-sm">
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">{t('landing.ctaTitle')}</h2>
          <p className="text-xl text-gray-400 mb-8">
            {t('landing.ctaSubtitle')}
          </p>
          {isAuthenticated ? (
            <Link to="/dashboard" className="inline-block px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-lg font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/25">
              {t('landing.goToDashboard')}
            </Link>
          ) : (
            <Link to="/register" className="inline-block px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-lg font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/25">
              {t('landing.startTrialNow')}
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white font-semibold">{t('common.appName', 'CyberSec Pro')}</span>
          </div>
          <p className="text-gray-500 text-sm">
            {t('landing.copyright')}
          </p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Link to="/dashboard/privacy" className="text-gray-500 text-sm hover:text-gray-300 transition">{t('landing.footer.privacyPolicy')}</Link>
            <Link to="/dashboard/terms" className="text-gray-500 text-sm hover:text-gray-300 transition">{t('landing.footer.termsOfService')}</Link>
            <Link to="/dashboard/gdpr" className="text-gray-500 text-sm hover:text-gray-300 transition">{t('landing.footer.gdpr')}</Link>
            <span className="text-gray-600 text-xs">{t('landing.footer.euCompliant')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
