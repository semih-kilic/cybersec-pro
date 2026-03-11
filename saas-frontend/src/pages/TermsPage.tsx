import { Link } from 'react-router-dom';

export default function TermsPage() {
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
          <Link to="/" className="text-gray-400 hover:text-white transition text-sm">← Back to Home</Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="bg-gray-800/50 rounded-2xl p-8 md:p-12 border border-gray-700">
          <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-gray-400 mb-8">Last updated: February 11, 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
              <p>By accessing or using CyberSec Pro ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">2. Service Description</h2>
              <p>CyberSec Pro provides a cloud-based penetration testing platform with access to security tools for authorized testing purposes. The Service includes:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Access to 401 Kali Linux security tools via web interface</li>
                <li>Scan scheduling and execution capabilities</li>
                <li>Report generation and vulnerability tracking</li>
                <li>Remote agent management for distributed testing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">3. Acceptable Use</h2>
              <p>You agree to use the Service only for <strong className="text-white">authorized security testing</strong>. You must:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Have explicit written authorization before scanning any target</li>
                <li>Only scan systems you own or have permission to test</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Not use the Service for any malicious, illegal, or unauthorized purpose</li>
                <li>Not attempt to disrupt the Service or other users' operations</li>
              </ul>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mt-3">
                <p className="text-red-400 font-medium">⚠️ Unauthorized scanning is illegal. CyberSec Pro is not responsible for misuse of the platform. Violations will result in immediate account termination and may be reported to relevant authorities.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">4. Account Responsibilities</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You must provide accurate and complete registration information</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
                <li>You are responsible for all activities conducted under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">5. Subscription & Payment</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>All prices are displayed in Euros (€) and exclude applicable VAT</li>
                <li>Subscriptions are billed monthly or annually, depending on your selection</li>
                <li>Payments are processed securely via Stripe</li>
                <li>You may cancel your subscription at any time; access continues until the end of the billing period</li>
                <li>Refunds are available within 30 days of initial purchase</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">6. Data Processing</h2>
              <p>We process your data in accordance with our <Link to="/dashboard/privacy" className="text-cyan-400 hover:underline">Privacy Policy</Link> and the GDPR. For enterprise customers, we offer a Data Processing Agreement (DPA) upon request.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">7. Intellectual Property</h2>
              <p>The CyberSec Pro platform, including its design, code, and documentation, is the intellectual property of Semih Kılıç. The security tools available through the platform are open-source and distributed under their respective licenses.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
              <p>CyberSec Pro is provided "as is" without warranty of any kind. We are not liable for any damages arising from the use or inability to use the Service, including but not limited to damages caused by scan results, tool outputs, or service interruptions.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">9. Governing Law</h2>
              <p>These Terms are governed by the laws of the European Union and the applicable national law. Any disputes shall be resolved in the competent courts of the European Union.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">10. Contact</h2>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <p>Email: <a href="mailto:cybersecpro@semihkilic.com" className="text-cyan-400 hover:underline">cybersecpro@semihkilic.com</a></p>
                <p>Website: <a href="https://cybersecpro.semihkilic.com" className="text-cyan-400 hover:underline">cybersecpro.semihkilic.com</a></p>
              </div>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link to="/dashboard/privacy" className="text-gray-400 hover:text-white transition text-sm">Privacy Policy</Link>
          <span className="text-gray-600">•</span>
          <Link to="/dashboard/gdpr" className="text-gray-400 hover:text-white transition text-sm">GDPR Information</Link>
          <span className="text-gray-600">•</span>
          <Link to="/" className="text-gray-400 hover:text-white transition text-sm">Home</Link>
        </div>
      </div>
    </div>
  );
}
