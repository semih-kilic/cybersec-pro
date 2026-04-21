import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useUtilities';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('verifyEmail.title', 'Verify Email')} — CyberSec Pro`);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  void authLogin; // reserved for future auto-login after verification

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'no-token'>('verifying');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }
    verifyEmail(token);
  }, [token]);

  const verifyEmail = async (verifyToken: string) => {
    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken }),
      });

      const data = await res.json();

      if (res.ok && data.access_token) {
        setStatus('success');
        setMessage(data.message || t('verifyEmail.successMessage', 'Email verified successfully!'));
        // Auto-login: store token and redirect
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.organization) {
          localStorage.setItem('organization', JSON.stringify(data.organization));
        }
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setStatus('error');
        setMessage(data.error || t('verifyEmail.failed', 'Verification failed'));
      }
    } catch {
      setStatus('error');
      setMessage(t('verifyEmail.networkError', 'Network error. Please try again.'));
    }
  };

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendStatus('sending');
    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendStatus('sent');
      } else {
        setResendStatus('error');
        setMessage(data.error || t('verifyEmail.couldNotResend', 'Could not resend'));
      }
    } catch {
      setResendStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl">{t('common.appName', 'CyberSec Pro')}</span>
          </Link>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
          {/* Verifying */}
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <h2 className="text-xl font-bold text-white mb-2">{t('verifyEmail.verifying', 'Verifying Your Email...')}</h2>
              <p className="text-gray-400">{t('verifyEmail.verifyingBody', 'Please wait while we confirm your email address.')}</p>
            </>
          )}

          {/* Success */}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{t('verifyEmail.verified', 'Email Verified! ✅')}</h2>
              <p className="text-gray-400 mb-4">{message}</p>
              <p className="text-blue-400 text-sm">{t('verifyEmail.redirecting', 'Redirecting to dashboard...')}</p>
            </>
          )}

          {/* Error */}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{t('verifyEmail.failed', 'Verification failed')}</h2>
              <p className="text-gray-400 mb-6">{message}</p>

              {/* Resend form */}
              <div className="border-t border-gray-800 pt-6 mt-6">
                <p className="text-gray-500 text-sm mb-3">{t('verifyEmail.needNewLink', 'Need a new verification link?')}</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder={t('verifyEmail.emailPlaceholder', 'your@email.com')}
                    className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <button
                    onClick={handleResend}
                    disabled={!resendEmail || resendStatus === 'sending'}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                  >
                    {resendStatus === 'sending' ? '...' : t('verifyEmail.resend', 'Resend')}
                  </button>
                </div>
                {resendStatus === 'sent' && (
                  <p className="text-green-400 text-xs mt-2">{t('verifyEmail.sent', 'New verification link sent! Check your inbox.')}</p>
                )}
              </div>
            </>
          )}

          {/* No token */}
          {status === 'no-token' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{t('verifyEmail.noToken', 'No Verification Token')}</h2>
              <p className="text-gray-400 mb-6">{t('verifyEmail.noTokenBody', 'This page requires a verification link from your email.')}</p>

              {/* Resend form */}
              <div className="border-t border-gray-800 pt-6 mt-6">
                <p className="text-gray-500 text-sm mb-3">{t('verifyEmail.enterEmail', 'Enter your email to receive a new verification link:')}</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder={t('verifyEmail.emailPlaceholder', 'your@email.com')}
                    className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <button
                    onClick={handleResend}
                    disabled={!resendEmail || resendStatus === 'sending'}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                  >
                    {resendStatus === 'sending' ? '...' : t('verifyEmail.send', 'Send')}
                  </button>
                </div>
                {resendStatus === 'sent' && (
                  <p className="text-green-400 text-xs mt-2">{t('verifyEmail.sent', 'Verification link sent! Check your inbox.')}</p>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-gray-600 text-sm">
          <Link to="/login" className="text-blue-400 hover:text-blue-300">{t('auth.backToLogin', 'Back to Login')}</Link>
        </p>
      </div>
    </div>
  );
}
