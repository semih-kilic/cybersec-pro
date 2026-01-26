import { Link } from 'react-router-dom';

/**
 * 🐉 CyberSec Pro Landing Page
 * Modern cybersecurity SaaS platform landing
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Nav */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">CyberSec Pro</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-300 hover:text-white transition">
                Sign in
              </Link>
              <Link to="/register" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition">
                Start Free Trial
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium mb-8">
            🚀 143+ Professional Security Tools
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Professional<br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Penetration Testing
            </span><br />
            Platform
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Access 143+ security tools through one powerful dashboard. From reconnaissance to exploitation, we've got everything you need for comprehensive security testing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-lg font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/25">
              Start Free Trial - 14 Days
            </Link>
            <a href="#features" className="px-8 py-4 bg-gray-800 text-white text-lg font-medium rounded-xl hover:bg-gray-700 transition border border-gray-700">
              See Features →
            </a>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Everything You Need</h2>
            <p className="text-gray-400 text-lg">Professional-grade security tools in one platform</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🔍', title: 'Reconnaissance', desc: '18 tools for information gathering, DNS recon, subdomain enumeration' },
              { icon: '🌐', title: 'Web Application', desc: '16 tools for web scanning, SQL injection, XSS testing, fuzzing' },
              { icon: '🔐', title: 'Password Attacks', desc: '12 tools for hash cracking, brute force, dictionary attacks' },
              { icon: '🛡️', title: 'Vulnerability Analysis', desc: '11 tools for scanning, SSL testing, vulnerability detection' },
              { icon: '💀', title: 'Exploitation', desc: '6 tools including Metasploit Framework for authorized testing' },
              { icon: '📊', title: 'Forensics', desc: '11 tools for memory analysis, file carving, steganography' },
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
            <h2 className="text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 text-lg">No hidden fees • Cancel anytime</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <div className="text-lg font-medium text-gray-400 mb-2">Starter</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold text-white">€19</span>
                <span className="text-gray-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 33 Essential Tools
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 10 scans/month
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Basic Reports
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Email Support
                </li>
              </ul>
              <Link to="/register" className="block w-full py-3 bg-gray-700 text-white text-center rounded-xl hover:bg-gray-600 transition">
                Start Free Trial
              </Link>
            </div>

            {/* Professional */}
            <div className="bg-gray-800/50 rounded-2xl p-8 border-2 border-cyan-500 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-sm font-bold text-white">
                ⭐ Most Popular
              </div>
              <div className="text-lg font-medium text-cyan-400 mb-2">Professional</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold text-white">€59</span>
                <span className="text-gray-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> <strong>120</strong> Advanced Tools
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 50 scans/month
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Advanced Reports (PDF)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> API Access
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Priority Support
                </li>
              </ul>
              <Link to="/register" className="block w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-center rounded-xl hover:from-cyan-600 hover:to-blue-600 transition">
                Start Professional
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <div className="text-lg font-medium text-yellow-400 mb-2">Enterprise</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold text-white">€149</span>
                <span className="text-gray-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> <strong>143+</strong> All Tools
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Unlimited scans
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Custom Reports
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 24/7 Priority Support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Team Management
                </li>
              </ul>
              <Link to="/register" className="block w-full py-3 bg-yellow-500 text-gray-900 text-center font-semibold rounded-xl hover:bg-yellow-400 transition">
                Go Enterprise
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of security professionals using CyberSec Pro for their penetration testing needs.
          </p>
          <Link to="/register" className="inline-block px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-lg font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/25">
            Start Your Free Trial Now
          </Link>
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
            <span className="text-white font-semibold">CyberSec Pro</span>
          </div>
          <p className="text-gray-500 text-sm">
            © 2026 CyberSec Pro by Semih Kılıç. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
