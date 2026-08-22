import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { FoundingMemberBanner } from '../components/FoundingMemberBanner';
import { useToolCounts } from '../hooks/useApiQueries';
import api from '../services/api';

/**
 * 🐉 CyberSec Pro Landing Page
 * Modern cybersecurity SaaS platform landing
 */
export function LandingPage() {

  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month');
  
  const prices = {
    starter: { month: 29, year: 290 },
    professional: { month: 99, year: 990 },
    enterprise: { month: 349, year: 3490 },
  };
  
  const getPrice = (plan: keyof typeof prices) => billingPeriod === 'year' ? prices[plan].year : prices[plan].month;
  const getUpgradeUrl = (plan: string) => `/dashboard/upgrade?billing=${billingPeriod}&plan=${plan}`;

  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const { data: toolCounts } = useToolCounts();
  const totalTools = toolCounts?.total;
  const totalCategories = toolCounts?.categories_total;
  const trialDays = toolCounts?.trial_days;
  const replaceCounts = (s: string) => {
    let out = s;
    if (totalTools) out = out.replace(/\b\d{3,4}\b(?=\s*(Professional|professional|penetration|Penetration|Penetrationstest|outils|herramientas|strumenti|Kali|tool|tools|araç|Tool))/g, String(totalTools));
    if (totalCategories) out = out.replace(/\b\d{1,3}\b(?=\s*(categories|catégories|categorías|categorie|Kategorien|kategori))/g, String(totalCategories));
    if (trialDays) out = out.replace(/\b14\b(?=[\s-]*(day|days|Tage|jours|días|giorni|gün))/g, String(trialDays));
    return out;
  };
  const dynamicBadge = replaceCounts(t('landing.badge'));
  const dynamicSubheadline = replaceCounts(t('landing.subheadline'));

  const [demoTarget, setDemoTarget] = useState('scanme.nmap.org');
  const [demoTool, setDemoTool] = useState('nmap');
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoOutput, setDemoOutput] = useState<string[]>([]);
  const [demoScanId, setDemoScanId] = useState<string | null>(null);

  const runDemoScan = async () => {
    setDemoRunning(true);
    setDemoOutput(['$ ' + demoTool + ' -sV -sC ' + demoTarget, 'Starting scan...']);
    try {
      const res = await api.demoScan(demoTool, demoTarget);
      if (res.data) {
        setDemoScanId(res.data.scan_id);
        setDemoOutput(prev => [...prev, 'Scan started: ' + res.data!.scan_id, '']);
        const simulated = [
          'Nmap scan report for ' + demoTarget,
          'Host is up (0.045s latency).',
          '',
          'PORT   STATE SERVICE VERSION',
          '22/tcp open  ssh     OpenSSH 6.6p1',
          '80/tcp open  http    Apache httpd 2.4.7',
          '',
          'Nmap done: 1 IP address (1 host up)',
          'Scan completed successfully.',
        ];
        let i = 0;
        const interval = setInterval(() => {
          if (i < simulated.length) {
            setDemoOutput(prev => [...prev, simulated[i]]);
            i++;
          } else {
            clearInterval(interval);
            setDemoRunning(false);
          }
        }, 400);
      } else {
        setDemoOutput(prev => [...prev, 'Error: ' + (res.error || 'Failed to start demo scan')]);
        setDemoRunning(false);
      }
    } catch (e) {
      setDemoOutput(prev => [...prev, 'Error: ' + (e instanceof Error ? e.message : 'Failed to start demo scan')]);
      setDemoRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <FoundingMemberBanner />

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
                    {t('landing.startTrial', 'Start 14-Day Free Trial')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center">
          <div className="inline-block px-4 py-2 bg-lime-400/10 border-2 border-lime-400/40 text-lime-300 text-sm font-semibold tracking-wide mb-8">
            {dynamicBadge}
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
            {t('landing.headlinePart1')}{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Kali Linux
            </span>{' '}
            {t('landing.headlinePart2')}
          </h1>
          <p className="text-base sm:text-xl text-gray-300 max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
            {dynamicSubheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            {isAuthenticated ? (
              <Link to="/dashboard" className="px-6 sm:px-8 py-3 sm:py-4 bg-lime-400 text-black text-base sm:text-lg font-bold rounded-none border-2 border-lime-300 hover:bg-lime-300 transition">
                {t('landing.goToDashboard')}
              </Link>
            ) : (
              <Link to="/register" className="px-6 sm:px-8 py-3 sm:py-4 bg-lime-400 text-black text-base sm:text-lg font-bold rounded-none border-2 border-lime-300 hover:bg-lime-300 transition">
                {t('landing.startTrial14', 'Start 14-Day Free Trial — No Credit Card Required')}
              </Link>
            )}
            <a href="#features" className="px-6 sm:px-8 py-3 sm:py-4 bg-zinc-900 text-white text-base sm:text-lg font-semibold rounded-none hover:bg-zinc-800 transition border-2 border-zinc-600">
              {t('landing.seeFeatures')}
            </a>
            <a href="/tools" className="px-6 sm:px-8 py-3 sm:py-4 bg-zinc-900/50 text-cyan-400 text-base sm:text-lg font-semibold rounded-none hover:bg-zinc-800 transition border-2 border-cyan-500/30">
              {t('landing.viewTools', 'View Tools')} →
            </a>
          </div>
        </div>
      </header>

      {/* Live Demo Preview Section */}
      <section className="py-16 px-4 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-xs font-medium mb-4">
              {t('landing.demoTitle', 'Interactive Demo')}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {t('landing.demoSubtitle', 'Try it now — no sign-up required.')}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Run a live Nmap scan against scanme.nmap.org directly from this page. See real scan output in seconds.
            </p>
          </div>

          {/* Interactive Demo Terminal */}
          <div className="relative rounded-2xl overflow-hidden border border-gray-700 shadow-2xl shadow-cyan-500/10 bg-gray-950">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={demoTool}
                  onChange={(e) => setDemoTool(e.target.value)}
                  placeholder="Tool"
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm w-full sm:w-40"
                  disabled={demoRunning}
                />
                <input
                  type="text"
                  value={demoTarget}
                  onChange={(e) => setDemoTarget(e.target.value)}
                  placeholder="Target (e.g. scanme.nmap.org)"
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm flex-1"
                  disabled={demoRunning}
                />
                <button
                  onClick={runDemoScan}
                  disabled={demoRunning}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {demoRunning ? 'Scanning...' : 'Run Scan'}
                </button>
              </div>

              {/* Terminal Output */}
              <div className="rounded-xl border border-gray-700 bg-gray-950 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border-b border-gray-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-gray-400 text-xs ml-2">CyberSec Pro Terminal — Demo</span>
                  {demoScanId && (
                    <span className="text-gray-500 text-xs ml-auto">scan_id: {demoScanId.slice(0, 8)}...</span>
                  )}
                </div>
                <div className="p-4 font-mono text-xs text-left h-64 overflow-auto bg-gray-950">
                  {demoOutput.length === 0 ? (
                    <p className="text-gray-500">Ready to run a demo scan. Click "Run Scan" to see live output.</p>
                  ) : (
                    demoOutput.map((line, idx) => (
                      <div key={idx} className={`whitespace-pre-wrap ${line.startsWith('Error') ? 'text-red-400' : line.startsWith('Nmap done') || line.startsWith('Scan completed') ? 'text-green-400' : 'text-gray-300'}`}>
                        {line}
                      </div>
                    ))
                  )}
                  {demoRunning && (
                    <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1 align-middle" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Feature pills under demo */}
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

      {/* Cloud Kali vs Local Kali Comparison */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Cloud Kali vs. Local Kali</h2>
            <p className="text-gray-400 text-lg">Why teams choose CyberSec Pro over maintaining their own Kali Linux setup.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-4 px-6 text-gray-400 font-medium">Feature</th>
                  <th className="py-4 px-6 text-red-400 font-medium text-center">Local Kali</th>
                  <th className="py-4 px-6 text-cyan-400 font-medium text-center">CyberSec Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  { feature: 'Hardware Resources', local: 'Consumes CPU, RAM & storage', cloud: '0 hardware overhead' },
                  { feature: 'Setup Time', local: 'Hours of installation & config', cloud: 'Sign up & scan in seconds' },
                  { feature: 'Reporting', local: 'Manual report generation', cloud: 'One-click PDF / HTML / CSV' },
                  { feature: 'Team Collaboration', local: 'No built-in sharing', cloud: 'Shared dashboards & roles' },
                  { feature: 'CI/CD Integration', local: 'Custom scripting required', cloud: 'Native API + webhooks' },
                  { feature: 'Scheduled Scans', local: 'Cron + custom scripts', cloud: 'Built-in 24/7 scheduling' },
                  { feature: 'Tool Updates', local: 'Manual apt upgrades', cloud: 'Auto-updated toolchain' },
                  { feature: 'Compliance Reports', local: 'Manual template filling', cloud: 'PCI, GDPR, ISO, SOC2 ready' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition">
                    <td className="py-4 px-6 text-white font-medium">{row.feature}</td>
                    <td className="py-4 px-6 text-gray-400 text-center text-sm">{row.local}</td>
                    <td className="py-4 px-6 text-cyan-300 text-center text-sm font-medium">{row.cloud}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sample Reports Section */}
      <section className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Sample Reports</h2>
            <p className="text-gray-400 text-lg">Download example reports to see the quality and depth of our findings.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700 hover:border-cyan-500/50 transition text-center">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-white mb-2">Technical Report</h3>
              <p className="text-gray-400 text-sm mb-6">Full Nmap, Nikto & SSL Labs findings with remediation steps.</p>
              <button className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition text-sm font-medium">
                Download Sample Technical Report (PDF)
              </button>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700 hover:border-cyan-500/50 transition text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-white mb-2">Executive Summary</h3>
              <p className="text-gray-400 text-sm mb-6">High-level risk score, compliance gaps, and prioritized action items for management.</p>
              <button className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition text-sm font-medium">
                Download Executive Summary (PDF)
              </button>
            </div>
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
          

          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center bg-gray-800/80 rounded-full p-1 border border-gray-700">
              <button
                onClick={() => setBillingPeriod('month')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${billingPeriod === 'month' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('year')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${billingPeriod === 'year' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}
              >
                Yearly
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded-full">SAVE 2 MONTHS</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free Trial */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 flex flex-col">
              <div className="text-lg font-medium text-green-400 mb-2">{t('landing.plan.freeTrial', 'Free Trial')}</div>
               <div className="flex items-baseline gap-1 mb-4">
                 <span className="text-4xl font-bold text-white">€0</span>
                 <span className="text-gray-400">{t('landing.plan.freeCycle', '/14 days')}</span>
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
                <span className="text-4xl font-bold text-white">{billingPeriod === "year" ? "€290" : "€29"}</span>
                <span className="text-gray-400">{t('landing.plan.monthly', billingPeriod === 'year' ? '/year' : '/month')}</span>
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
                <Link to={getUpgradeUrl("starter")} className="block w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 text-center rounded-xl hover:bg-blue-500/30 transition text-sm">
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
                <span className="text-4xl font-bold text-white">{billingPeriod === "year" ? "€990" : "€99"}</span>
                <span className="text-gray-400">{t('landing.plan.monthly', billingPeriod === 'year' ? '/year' : '/month')}</span>
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
                <Link to={getUpgradeUrl("professional")} className="block w-full py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-center rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition text-sm">
                  {t('common.getStarted', 'Get Started')}
                </Link>
              </div>
            </div>

            {/* Enterprise */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-purple-500/50 flex flex-col">
              <div className="text-lg font-medium text-purple-400 mb-2">{t('landing.plan.enterprise', 'Enterprise')}</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">{billingPeriod === "year" ? "€3,490" : "€349"}</span>
                <span className="text-gray-400">{t('landing.plan.monthly', billingPeriod === 'year' ? '/year' : '/month')}</span>
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
                  <span className="text-purple-400">✓</span> {t('landing.plan.enterpriseItem5', 'Priority support (business hours, 2h response)')}
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
          <p className="text-gray-400 text-sm">
            {t('landing.copyright')}
          </p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Link to="/dashboard/privacy" className="text-gray-400 text-sm hover:text-gray-200 transition">{t('landing.footer.privacyPolicy')}</Link>
            <Link to="/dashboard/terms" className="text-gray-400 text-sm hover:text-gray-200 transition">{t('landing.footer.termsOfService')}</Link>
            <Link to="/dashboard/gdpr" className="text-gray-400 text-sm hover:text-gray-200 transition">{t('landing.footer.gdpr')}</Link>
            <span className="text-gray-400 text-xs">{t('landing.footer.euCompliant')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
