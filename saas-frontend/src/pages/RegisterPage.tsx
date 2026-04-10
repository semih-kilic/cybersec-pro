import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import MatrixRainBg from '../components/ui/MatrixRainBg';

// OAuth Configuration
const GOOGLE_CLIENT_ID = '547951331800-kqkuc6aohfr7ptt26p38mnqfdvt7b6mu.apps.googleusercontent.com';
const GITHUB_CLIENT_ID = '***REDACTED_GH_OAUTH_CLIENT_ID***';

export function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    organization_name: '',
    first_name: '',
    last_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const { register: _register } = useAuth();  // unused after V13 email verification flow
  void _register; // suppress unused variable warning
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleGoogleLogin = () => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'openid email profile';
    localStorage.setItem('oauth_provider', 'google');
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = googleAuthUrl;
  };

  const handleGitHubLogin = () => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'user:email';
    localStorage.setItem('oauth_provider', 'github');
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = githubAuthUrl;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    setLoading(true);

    try {
      // V13: Registration now requires email verification
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          organization_name: formData.organization_name,
          first_name: formData.first_name,
          last_name: formData.last_name,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.requires_verification) {
        // Show verification message instead of redirecting
        setVerificationSent(true);
        setVerificationEmail(formData.email);
      } else if (res.ok && data.access_token) {
        // Legacy: if server returns token directly (OAuth users)
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <MatrixRainBg />
      {/* Verification Sent Screen */}
      {verificationSent && (
        <div className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
              <div className="w-16 h-16 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Check Your Email 📧</h2>
              <p className="text-gray-400 mb-2">
                We sent a verification link to:
              </p>
              <p className="text-blue-400 font-medium mb-6">{verificationEmail}</p>
              <p className="text-gray-500 text-sm mb-6">
                Click the link in the email to verify your account and start your 14-day free trial.
                The link expires in 24 hours.
              </p>

              <div className="border-t border-gray-800 pt-6 space-y-3">
                <p className="text-gray-600 text-xs">Didn't receive the email? Check your spam folder or:</p>
                <button
                  onClick={async () => {
                    setResendStatus('sending');
                    try {
                      const res = await fetch('/api/v1/auth/resend-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: verificationEmail }),
                      });
                      if (res.ok) setResendStatus('sent');
                      else {
                        const data = await res.json();
                        setError(data.error || '');
                        setResendStatus('error');
                      }
                    } catch { setResendStatus('error'); }
                  }}
                  disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {resendStatus === 'sending' ? 'Sending...' : resendStatus === 'sent' ? '✅ Sent!' : 'Resend Verification Email'}
                </button>
                {resendStatus === 'sent' && (
                  <p className="text-green-400 text-xs">New verification link sent!</p>
                )}
              </div>

              <p className="mt-6 text-gray-600 text-sm">
                <Link to="/login" className="text-blue-400 hover:text-blue-300">Back to Login</Link>
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Left Panel - Cybersecurity Awareness (40%) */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Effect */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500 rounded-full filter blur-[100px]" />
          <div className="absolute bottom-20 right-10 w-64 h-64 bg-cyan-500 rounded-full filter blur-[100px]" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl">CyberSec Pro</span>
          </Link>

          {/* Main Headline */}
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Your Digital Assets<br />Are Under Threat
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Cybersecurity isn't just an IT concern — it's a business survival issue.
          </p>

          {/* Threat Awareness Cards */}
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-5 border border-red-500/20 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Ransomware Surge</p>
                  <p className="text-gray-400 text-xs leading-relaxed">A ransomware attack hits a business every 11 seconds. Average ransom payments have exceeded $1.5 million.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-5 border border-amber-500/20 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">The Human Factor</p>
                  <p className="text-gray-400 text-xs leading-relaxed">68% of breaches involve a non-malicious human element — phishing, misconfigurations, and weak credentials.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-5 border border-cyan-500/20 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Prevention Works</p>
                  <p className="text-gray-400 text-xs leading-relaxed">Organizations with proactive security testing reduce breach costs by an average of $1.76 million.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Country flags */}
          <div className="mt-8 flex items-center gap-3">
            <span className="text-gray-500 text-xs">Serving teams in</span>
            <div className="flex gap-1.5 text-lg">
              <span title="USA">🇺🇸</span>
              <span title="Canada">🇨🇦</span>
              <span title="UK">🇬🇧</span>
              <span title="Germany">🇩🇪</span>
              <span title="Turkey">🇹🇷</span>
              <span title="France">🇫🇷</span>
              <span title="Netherlands">🇳🇱</span>
              <span title="Sweden">🇸🇪</span>
              <span title="Finland">🇫🇮</span>
              <span className="text-gray-500 text-xs ml-1">+21 more</span>
            </div>
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 mt-12">
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 backdrop-blur">
            <p className="text-gray-300 text-sm leading-relaxed">
              <span className="text-cyan-400 font-semibold">"</span>
              The question is not whether you will be breached, but when. The only defense is preparation.
              <span className="text-cyan-400 font-semibold">"</span>
            </p>
            <p className="text-gray-500 text-xs mt-3">— Cybersecurity Awareness Principle</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Registration Form (60%) */}
      <div className="w-full lg:w-[60%] bg-gray-950 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-white font-bold text-xl">CyberSec Pro</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-gray-400 mb-8">Start your 14-day free trial. No credit card required.</p>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleGoogleLogin}
              className="py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button
              onClick={handleGitHubLogin}
              className="py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2 text-sm border border-gray-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gray-950 text-gray-500">or register with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('auth.firstName')}</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('auth.lastName')}</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Work Email *</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Company *</label>
              <input
                type="text"
                name="organization_name"
                required
                value={formData.organization_name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm"
                placeholder="Acme Security Oy"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password *</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm"
                placeholder="••••••••"
              />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-gray-500 text-xs leading-relaxed">
                I agree to the{' '}
                <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>.
                Your data is stored in EU (Finland) and processed per GDPR.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreedTerms}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Creating account...' : 'Start Free Trial →'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign in
            </Link>
          </p>

          {/* Back to Home (mobile) */}
          <div className="mt-4 text-center lg:hidden">
            <Link to="/" className="text-gray-600 hover:text-gray-400 text-xs">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
