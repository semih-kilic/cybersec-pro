import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CountryFlags } from '../components/CountryFlags';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!token) setError('Invalid or missing reset token. Please request a new password reset link.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Reset failed. The link may have expired.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    .rp-root{font-family:'Inter',system-ui,sans-serif;min-height:100vh;background:#0a0a0a;display:flex;align-items:center;justify-content:center;padding:24px;position:relative}
    .rp-root *{box-sizing:border-box;margin:0;padding:0}
    .rp-card{width:100%;max-width:420px;position:relative;z-index:2}
    .rp-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:.9rem;color:#f0f0f0;margin-bottom:40px;justify-content:center;text-decoration:none}
    .rp-icon{width:56px;height:56px;border-radius:16px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.12);display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
    .rp-title{font-size:1.4rem;font-weight:700;color:#f0f0f0;text-align:center;margin-bottom:6px;letter-spacing:-.02em}
    .rp-sub{font-size:.82rem;color:#4b5563;text-align:center;margin-bottom:28px;line-height:1.6}
    .rp-field{margin-bottom:18px}
    .rp-label{display:block;font-size:.78rem;font-weight:500;color:#9ca3af;margin-bottom:6px}
    .rp-input-wrap{position:relative}
    .rp-input{width:100%;padding:11px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f0f0f0;font-size:.85rem;font-family:inherit;outline:none;transition:all .2s}
    .rp-input::placeholder{color:#374151}
    .rp-input:focus{border-color:rgba(16,185,129,.4);box-shadow:0 0 0 3px rgba(16,185,129,.08)}
    .rp-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:#4b5563;cursor:pointer;padding:2px;transition:color .2s}
    .rp-eye:hover{color:#9ca3af}
    .rp-btn{width:100%;padding:12px;background:#10b981;color:#000;font-weight:700;font-size:.85rem;border:none;border-radius:10px;cursor:pointer;font-family:inherit;transition:all .2s;letter-spacing:-.01em}
    .rp-btn:hover:not(:disabled){background:#22d3a0;transform:translateY(-1px);box-shadow:0 4px 20px rgba(16,185,129,.25)}
    .rp-btn:disabled{opacity:.5;cursor:not-allowed}
    .rp-back{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:24px;font-size:.78rem;color:#4b5563;text-decoration:none;transition:color .2s}
    .rp-back:hover{color:#9ca3af}
    .rp-error{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:10px;padding:12px 14px;margin-bottom:18px;color:#ef4444;font-size:.8rem}
    .rp-success{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:16px;padding:32px;text-align:center}
    .rp-success-icon{width:56px;height:56px;border-radius:16px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
    .rp-success h3{font-size:1.1rem;font-weight:700;color:#f0f0f0;margin-bottom:8px}
    .rp-success p{font-size:.82rem;color:#6b7280;line-height:1.6}
    .rp-hint{font-size:.7rem;color:#374151;margin-top:4px}
    .rp-strength{height:3px;margin-top:8px;border-radius:2px;transition:all .3s}
  `;

  const getStrength = (pw: string) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    return s;
  };

  const strength = getStrength(password);
  const strengthColor = ['#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981'][Math.max(0, strength - 1)] || '#374151';
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][strength] || '';

  return (
    <>
      <style>{css}</style>
      <div className="rp-root">
        <div className="rp-card">
          <Link to="/" className="rp-logo">
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none"><rect width="26" height="26" rx="6" fill="url(#lg4)"/><path d="M7.5 13l3 3 8-8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><defs><linearGradient id="lg4" x1="0" y1="0" x2="26" y2="26"><stop stopColor="#10b981"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs></svg>
            CyberSec Pro
          </Link>

          {success ? (
            <div className="rp-success">
              <div className="rp-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <h3>{t('auth.passwordReset', 'Password reset successful')}</h3>
              <p>{t('auth.passwordResetDesc', 'Your password has been updated. You can now sign in with your new password.')}</p>
              <Link to="/login" style={{ display: 'inline-block', marginTop: '20px', padding: '10px 24px', background: '#10b981', color: '#000', fontWeight: 700, fontSize: '.85rem', borderRadius: '10px', textDecoration: 'none', transition: 'all .2s' }}>
                {t('auth.signIn', 'Sign in')}
              </Link>
            </div>
          ) : (
            <>
              <div className="rp-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              </div>
              <h2 className="rp-title">{t('auth.setNewPassword', 'Set new password')}</h2>
              <p className="rp-sub">{t('auth.newPasswordDesc', 'Create a strong password with at least 8 characters.')}</p>

              {error && <div className="rp-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="rp-field">
                  <label className="rp-label">{t('auth.newPassword', 'New password')}</label>
                  <div className="rp-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rp-input"
                      placeholder={t('auth.passwordMinLength', 'Min. 8 characters')}
                      autoFocus
                      style={{ paddingRight: '40px' }}
                    />
                    <button type="button" className="rp-eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                  {password && (
                    <>
                      <div className="rp-strength" style={{ background: strengthColor, width: `${(strength / 5) * 100}%` }} />
                      <p className="rp-hint" style={{ color: strengthColor }}>{strengthLabel}</p>
                    </>
                  )}
                </div>

                <div className="rp-field">
                  <label className="rp-label">{t('auth.confirmPassword', 'Confirm password')}</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rp-input"
                    placeholder={t('auth.reenterPassword', 'Re-enter your password')}
                  />
                </div>

                <button type="submit" disabled={loading || !token} className="rp-btn">
                  {loading ? t('auth.resetting', 'Resetting...') : t('auth.resetPassword', 'Reset password')}
                </button>
              </form>

              <Link to="/login" className="rp-back">
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
