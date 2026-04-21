import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CountryFlags } from '../components/CountryFlags';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    .fp-root{font-family:'Inter',system-ui,sans-serif;min-height:100vh;background:#0a0a0a;display:flex;align-items:center;justify-content:center;padding:24px;position:relative}
    .fp-root *{box-sizing:border-box;margin:0;padding:0}
    .fp-card{width:100%;max-width:420px;position:relative;z-index:2}
    .fp-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:.9rem;color:#f0f0f0;margin-bottom:40px;justify-content:center;text-decoration:none}
    .fp-icon{width:56px;height:56px;border-radius:16px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.12);display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
    .fp-title{font-size:1.4rem;font-weight:700;color:#f0f0f0;text-align:center;margin-bottom:6px;letter-spacing:-.02em}
    .fp-sub{font-size:.82rem;color:#4b5563;text-align:center;margin-bottom:28px;line-height:1.6}
    .fp-field{margin-bottom:20px}
    .fp-label{display:block;font-size:.78rem;font-weight:500;color:#9ca3af;margin-bottom:6px}
    .fp-input{width:100%;padding:11px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f0f0f0;font-size:.85rem;font-family:inherit;outline:none;transition:all .2s}
    .fp-input::placeholder{color:#374151}
    .fp-input:focus{border-color:rgba(16,185,129,.4);box-shadow:0 0 0 3px rgba(16,185,129,.08)}
    .fp-btn{width:100%;padding:12px;background:#10b981;color:#000;font-weight:700;font-size:.85rem;border:none;border-radius:10px;cursor:pointer;font-family:inherit;transition:all .2s;letter-spacing:-.01em}
    .fp-btn:hover:not(:disabled){background:#22d3a0;transform:translateY(-1px);box-shadow:0 4px 20px rgba(16,185,129,.25)}
    .fp-btn:disabled{opacity:.5;cursor:not-allowed}
    .fp-back{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:24px;font-size:.78rem;color:#4b5563;text-decoration:none;transition:color .2s}
    .fp-back:hover{color:#9ca3af}
    .fp-error{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:10px;padding:12px 14px;margin-bottom:18px;color:#ef4444;font-size:.8rem}
    .fp-success{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:16px;padding:32px;text-align:center}
    .fp-success-icon{width:56px;height:56px;border-radius:16px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
    .fp-success h3{font-size:1.1rem;font-weight:700;color:#f0f0f0;margin-bottom:8px}
    .fp-success p{font-size:.82rem;color:#6b7280;line-height:1.6}
    .fp-success .fp-email{color:#10b981;font-weight:500}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="fp-root">
        <div className="fp-card">
          <Link to="/" className="fp-logo">
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none"><rect width="26" height="26" rx="6" fill="url(#lg3)"/><path d="M7.5 13l3 3 8-8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><defs><linearGradient id="lg3" x1="0" y1="0" x2="26" y2="26"><stop stopColor="#10b981"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs></svg>
            CyberSec Pro
          </Link>

          {sent ? (
            <div className="fp-success">
              <div className="fp-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </div>
              <h3>{t('auth.checkYourEmail', 'Check your email')}</h3>
              <p>
                {t('auth.resetEmailSent', 'If an account exists for')} <span className="fp-email">{email}</span>{t('auth.resetEmailSent2', ', we sent a password reset link. It expires in 1 hour.')}
              </p>
              <p style={{ marginTop: '12px', fontSize: '.75rem', color: '#374151' }}>
                {t('auth.checkSpam', "Don't see it? Check your spam folder.")}
              </p>
              <Link to="/login" className="fp-back" style={{ marginTop: '24px' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5"/></svg>
                {t('auth.backToLogin', 'Back to login')}
              </Link>
            </div>
          ) : (
            <>
              <div className="fp-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <h2 className="fp-title">{t('auth.forgotPassword', 'Forgot your password?')}</h2>
              <p className="fp-sub">{t('auth.forgotDesc', "No worries. Enter your email address and we'll send you a reset link.")}</p>

              {error && <div className="fp-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="fp-field">
                  <label className="fp-label">{t('auth.email', 'Email address')}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="fp-input"
                    placeholder={t('auth.emailPlaceholder', 'you@company.com')}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading} className="fp-btn">
                  {loading ? t('auth.sending', 'Sending...') : t('auth.sendResetLink', 'Send reset link')}
                </button>
              </form>

              <Link to="/login" className="fp-back">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5"/></svg>
                {t('auth.backToLogin', 'Back to login')}
              </Link>
            </>
          )}

          <div style={{ marginTop: '32px' }}>
            <CountryFlags />
          </div>
        </div>
      </div>
    </>
  );
}
